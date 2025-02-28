import { renderHook, act } from '@testing-library/react';
import { useSkyWay } from '../useSkyWay';

// SkyWayモジュールのモック
jest.mock('@skyway-sdk/room', () => ({
  SkyWayContext: {
    Create: jest.fn().mockResolvedValue({
      dispose: jest.fn(),
    }),
  },
}));

jest.mock('@skyway-sdk/core', () => {
  const mockLeave = jest.fn().mockResolvedValue(undefined);
  const mockPublish = jest.fn().mockResolvedValue({ id: 'test-publication-id' });
  const mockUnpublish = jest.fn().mockResolvedValue(undefined);

  return {
    SkyWayChannel: {
      FindOrCreate: jest.fn().mockResolvedValue({
        join: jest.fn().mockResolvedValue({
          id: 'test-id',
          name: 'test-user',
          state: 'joined',
          side: 'local',
          leave: mockLeave,
          publish: mockPublish,
          unpublish: mockUnpublish,
        }),
        members: [],
        onMemberJoined: { add: jest.fn() },
        onMemberLeft: { add: jest.fn() },
      }),
    },
    SkyWayStreamFactory: {
      createMicrophoneAudioStream: jest.fn().mockResolvedValue({
        track: {
          enabled: true,
        },
      }),
    },
  };
});

jest.mock('@/app/utils/skyway', () => ({
  generateSkyWayToken: jest.fn().mockReturnValue('mock-token'),
}));

describe('useSkyWay', () => {
  beforeEach(() => {
    // 各テストの前にモックをリセット
    jest.clearAllMocks();
  });

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSkyWay());

    expect(result.current.context).toBeNull();
    expect(result.current.channel).toBeNull();
    expect(result.current.person).toBeNull();
    expect(result.current.stream).toBeNull();
    expect(result.current.participants).toEqual([]);
    expect(result.current.isMuted).toBeFalsy();
  });

  it('should connect successfully', async () => {
    const { result } = renderHook(() => useSkyWay());

    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeTruthy();
    });

    expect(result.current.isConnected).toBeTruthy();
  });

  it('should handle mute/unmute toggle', async () => {
    const { result } = renderHook(() => useSkyWay());

    // 最初に接続
    await act(async () => {
      await result.current.connect('test-user');
    });

    // 初期状態はミュートされていない
    expect(result.current.isMuted).toBeFalsy();

    // ミュートに切り替え
    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.isMuted).toBeTruthy();

    // ミュート解除に切り替え
    await act(async () => {
      await result.current.toggleMute();
    });
    expect(result.current.isMuted).toBeFalsy();
  });

  it('should handle disconnect', async () => {
    const { result } = renderHook(() => useSkyWay());

    // 接続
    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeTruthy();
    });

    // 接続状態の確認
    expect(result.current.isConnected).toBeTruthy();
    expect(result.current.person).not.toBeNull();

    // 切断
    await act(async () => {
      await result.current.disconnect();
      // 状態の更新を確実に待つ
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 切断後の状態確認
    expect(result.current.person).toBeNull();
    expect(result.current.isConnected).toBeFalsy();
    expect(result.current.context).toBeNull();
    expect(result.current.channel).toBeNull();
    expect(result.current.stream).toBeNull();
    expect(result.current.participants).toEqual([]);
  });

  it('should handle connection error', async () => {
    // エラーを発生させるためにモックを一時的に変更
    const mockCreate = jest.spyOn(require('@skyway-sdk/room').SkyWayContext, 'Create');
    mockCreate.mockRejectedValueOnce(new Error('Connection failed'));

    const { result } = renderHook(() => useSkyWay());

    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeFalsy();
      expect(connectResult.error).toBeTruthy();
    });

    expect(result.current.isConnected).toBeFalsy();

    // モックを元に戻す
    mockCreate.mockRestore();
  });

  it('should handle member join events', async () => {
    const { result } = renderHook(() => useSkyWay());

    // モックの準備
    let memberJoinedCallback: ((event: { member: any }) => void) | null = null;
    const mockAdd = jest.fn((callback) => {
      memberJoinedCallback = callback;
      return { removeListener: jest.fn() };
    });

    // onMemberJoinedのモックを更新
    jest.mocked(require('@skyway-sdk/core').SkyWayChannel.FindOrCreate)
      .mockResolvedValueOnce({
        join: jest.fn().mockResolvedValue({
          id: 'test-id',
          name: 'test-user',
          state: 'joined',
          side: 'local',
          leave: jest.fn(),
          publish: jest.fn().mockResolvedValue({ id: 'test-publication-id' }),
          unpublish: jest.fn(),
        }),
        members: [],
        onMemberJoined: { add: mockAdd },
        onMemberLeft: { add: jest.fn() },
      });

    // 接続
    await act(async () => {
      await result.current.connect('test-user');
    });

    // 新しい参加者のイベントをシミュレート
    const newMember = {
      id: 'new-member-id',
      name: 'new-user',
      state: 'joined',
      side: 'remote',
    };

    await act(async () => {
      memberJoinedCallback?.({ member: newMember });
    });

    // 参加者リストに新しいメンバーが追加されていることを確認
    expect(result.current.participants).toHaveLength(2); // ローカルユーザー + 新しい参加者
    expect(result.current.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'test-id' }), // ローカルユーザー
        expect.objectContaining({ id: 'new-member-id' }), // 新しい参加者
      ])
    );
  });

  it('should handle member leave events', async () => {
    const { result } = renderHook(() => useSkyWay());

    // モックの準備
    let memberLeftCallback: ((event: { member: any }) => void) | null = null;
    const mockAdd = jest.fn((callback) => {
      memberLeftCallback = callback;
      return { removeListener: jest.fn() };
    });

    // 初期メンバーリストを設定
    const initialMembers = [
      {
        id: 'test-id',
        name: 'test-user',
        state: 'joined',
        side: 'local',
        leave: jest.fn(),
        publish: jest.fn().mockResolvedValue({ id: 'test-publication-id' }),
        unpublish: jest.fn(),
      },
      {
        id: 'other-id',
        name: 'other-user',
        state: 'joined',
        side: 'remote',
      },
    ];

    // onMemberLeftのモックを更新
    jest.mocked(require('@skyway-sdk/core').SkyWayChannel.FindOrCreate)
      .mockResolvedValueOnce({
        join: jest.fn().mockResolvedValue(initialMembers[0]),
        members: initialMembers,
        onMemberJoined: { add: jest.fn() },
        onMemberLeft: { add: mockAdd },
      });

    // SkyWayStreamFactoryのモックを更新
    jest.mocked(require('@skyway-sdk/core').SkyWayStreamFactory.createMicrophoneAudioStream)
      .mockResolvedValueOnce({
        track: {
          enabled: true,
        },
      });

    // 接続
    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeTruthy();
    });

    // 初期状態で2人のメンバーがいることを確認
    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'test-id' }),
        expect.objectContaining({ id: 'other-id' }),
      ])
    );

    // メンバー退出イベントをシミュレート
    await act(async () => {
      memberLeftCallback?.({ member: initialMembers[1] });
    });

    // 参加者リストから退出したメンバーが削除されていることを確認
    expect(result.current.participants).toHaveLength(1);
    expect(result.current.participants[0].id).toBe('test-id');
  });

  it('should handle reconnection', async () => {
    const { result } = renderHook(() => useSkyWay());

    // 最初の接続
    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeTruthy();
    });
    expect(result.current.isConnected).toBeTruthy();

    // 切断
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.isConnected).toBeFalsy();

    // 再接続
    await act(async () => {
      const reconnectResult = await result.current.connect('test-user');
      expect(reconnectResult.success).toBeTruthy();
    });

    // 再接続後の状態確認
    expect(result.current.isConnected).toBeTruthy();
    expect(result.current.person).not.toBeNull();
    expect(result.current.participants).toHaveLength(1);
  });

  it('should handle multiple connections', async () => {
    const { result } = renderHook(() => useSkyWay());

    // 最初の接続
    await act(async () => {
      const firstConnect = await result.current.connect('test-user');
      expect(firstConnect.success).toBeTruthy();
    });

    // 既に接続中の状態で再度接続を試みる
    await act(async () => {
      const secondConnect = await result.current.connect('test-user');
      // 既存の接続を切断して新しい接続を確立するはず
      expect(secondConnect.success).toBeTruthy();
    });

    // 最終的な状態確認
    expect(result.current.isConnected).toBeTruthy();
    expect(result.current.person).not.toBeNull();
    expect(result.current.participants).toHaveLength(1);
  });

  it('should handle network errors', async () => {
    const { result } = renderHook(() => useSkyWay());

    // ネットワークエラーをシミュレート
    jest.mocked(require('@skyway-sdk/core').SkyWayChannel.FindOrCreate)
      .mockRejectedValueOnce(new Error('Network error'));

    // 接続試行
    await act(async () => {
      const connectResult = await result.current.connect('test-user');
      expect(connectResult.success).toBeFalsy();
      expect(connectResult.error).toContain('接続に失敗しました');
    });

    // エラー後の状態確認
    expect(result.current.isConnected).toBeFalsy();
    expect(result.current.person).toBeNull();
    expect(result.current.participants).toHaveLength(0);

    // エラー後のリカバリー（再接続）
    jest.mocked(require('@skyway-sdk/core').SkyWayChannel.FindOrCreate)
      .mockResolvedValueOnce({
        join: jest.fn().mockResolvedValue({
          id: 'test-id',
          name: 'test-user',
          state: 'joined',
          side: 'local',
          leave: jest.fn(),
          publish: jest.fn().mockResolvedValue({ id: 'test-publication-id' }),
          unpublish: jest.fn(),
        }),
        members: [],
        onMemberJoined: { add: jest.fn() },
        onMemberLeft: { add: jest.fn() },
      });

    await act(async () => {
      const reconnectResult = await result.current.connect('test-user');
      expect(reconnectResult.success).toBeTruthy();
    });

    // リカバリー後の状態確認
    expect(result.current.isConnected).toBeTruthy();
    expect(result.current.person).not.toBeNull();
  });
});
