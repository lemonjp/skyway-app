'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

// SkyWayの型定義のみをインポート
import type { SkyWayContext } from '@skyway-sdk/room';
import type {
  Channel,
  SkyWayChannel,
  LocalPerson,
  LocalStream,
  LocalAudioStream,
  Member,
  MemberJoinedEvent,
  MemberLeftEvent,
} from '@skyway-sdk/core';

// カスタムエラー型の定義
interface SkyWayError {
  message: string;
}

// 型ガード関数
function isSkyWayError(error: unknown): error is SkyWayError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as SkyWayError).message === 'string'
  );
}

// 接続結果の型を定義
interface ConnectResult {
  success: boolean;
  error?: string;
}

export const useSkyWay = () => {
  const [context, setContext] = useState<SkyWayContext | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [person, setPerson] = useState<LocalPerson | null>(null);
  const [stream, setStream] = useState<LocalAudioStream | null>(null);
  const [publications, setPublications] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Member[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  // 参加者リストを監視する関数
  const subscribeToParticipants = useCallback(() => {
    if (!channel || !person) return;

    try {
      // 初期の参加者リストを設定
      const members = channel.members;
      console.log('Initial members:', members);

      // アクティブなメンバーのみをフィルタリング（自分以外）
      const activeMembers = members.filter(member =>
        member.state === 'joined' && member.id !== person.id
      );
      console.log('Active members:', activeMembers);

      // 自分を含めた参加者リストを設定
      setParticipants([person, ...activeMembers]);

      // 新しい参加者の監視
      const memberJoinedHandler = channel.onMemberJoined.add((event: MemberJoinedEvent) => {
        try {
          console.log('Member joined:', event.member);
          if (event.member && event.member.id !== person.id) {
            setParticipants(prev => {
              if (prev.some(p => p.id === event.member.id)) return prev;
              return [...prev, event.member];
            });
          }
        } catch (error) {
          console.error('Member joined handler error:', error);
        }
      });

      // 退出した参加者の監視
      const memberLeftHandler = channel.onMemberLeft.add((event: MemberLeftEvent) => {
        try {
          console.log('Member left:', event.member);
          setParticipants(prev => prev.filter(p => p.id !== event.member.id));
        } catch (error) {
          console.error('Member left handler error:', error);
        }
      });

      return { memberJoinedHandler, memberLeftHandler };
    } catch (error) {
      console.error('Subscribe to participants error:', error);
      return null;
    }
  }, [channel, person]);

  // チャンネル接続時に参加者監視を開始
  useEffect(() => {
    let handlers: ReturnType<typeof subscribeToParticipants> | null = null;

    if (channel && person) {
      handlers = subscribeToParticipants();
    }

    return () => {
      if (handlers) {
        handlers.memberJoinedHandler?.removeListener();
        handlers.memberLeftHandler?.removeListener();
      }
    };
  }, [channel, person, subscribeToParticipants]);

  // 切断処理を先に定義
  const disconnect = useCallback(async () => {
    try {
      if (person && publications.length > 0) {
        for (const pubId of publications) {
          await person.unpublish(pubId);
        }
        setPublications([]);
        setStream(null);
      }
      if (person) {
        await person.leave();
        setPerson(null);
      }
      if (channel) {
        setChannel(null);
      }
      if (context) {
        await context.dispose();
        setContext(null);
      }
      setParticipants([]);
    } catch (error) {
      console.error('切断エラー:', error);
    }
  }, [context, channel, person, publications]);

  const connect = useCallback(async (username: string): Promise<ConnectResult> => {
    try {
      // 既存の接続をクリーンアップ
      if (person || channel || context) {
        await disconnect();
      }

      // SkyWayモジュールを動的にインポート
      const [{ SkyWayContext }, { SkyWayChannel, SkyWayStreamFactory }] = await Promise.all([
        import('@skyway-sdk/room'),
        import('@skyway-sdk/core')
      ]);

      // トークンを生成
      const { generateSkyWayToken } = await import('../utils/skyway');
      const token = generateSkyWayToken({
        username,
        roomName: 'meeting-room'
      });

      // SkyWayのコンテキストを初期化
      const newContext = await SkyWayContext.Create(token);
      setContext(newContext);

      // チャンネルを探すか作成
      const newChannel = await SkyWayChannel.FindOrCreate(newContext, {
        name: 'meeting-room'
      });
      setChannel(newChannel);

      // チャンネルに参加
      try {
        const newPerson = await newChannel.join({
          name: username
        });
        setPerson(newPerson);
        setChannel(newChannel);

        // メンバー情報を取得して設定
        const members = newChannel.members;
        const activeMembers = members.filter(member =>
          member.state === 'joined' && member.id !== newPerson.id
        );
        setParticipants([newPerson, ...activeMembers]);

        // マイクのストリームを取得
        const audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();

        // ストリームを公開
        const audioPub = await newPerson.publish(audioStream);

        // publicationのIDを保存
        setPublications([audioPub.id]);
        setStream(audioStream);

        return { success: true };
      } catch (error: unknown) {
        if (isSkyWayError(error) && error.message.includes('alreadySameNameMemberExist')) {
          // 同名ユーザーが存在する場合は、古い接続を切断するまで待機
          await new Promise(resolve => setTimeout(resolve, 2000));
          // 再試行
          const newPerson = await newChannel.join({
            name: username
          });
          setPerson(newPerson);

          // メンバー情報を取得して設定
          const members = newChannel.members;
          const activeMembers = members.filter(member =>
            member.state === 'joined' && member.id !== newPerson.id
          );
          setParticipants([newPerson, ...activeMembers]);

          // マイクのストリームを取得
          const audioStream = await SkyWayStreamFactory.createMicrophoneAudioStream();

          // ストリームを公開
          const audioPub = await newPerson.publish(audioStream);

          // publicationのIDを保存
          setPublications([audioPub.id]);
          setStream(audioStream);

          return { success: true };
        } else {
          throw error;
        }
      }
    } catch (error: unknown) {
      console.error('SkyWay接続エラー:', error);
      await disconnect();
      return {
        success: false,
        error: isSkyWayError(error) && error.message.includes('alreadySameNameMemberExist')
          ? '同じ名前のユーザーが既に接続しています。しばらく待ってから再試行してください。'
          : '接続に失敗しました。もう一度お試しください。'
      };
    }
  }, [person, channel, context, disconnect]);

  // ミュート切り替え関数
  const toggleMute = useCallback(async () => {
    if (!stream) return;

    try {
      const audioTrack = stream.track;
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    } catch (error) {
      console.error('ミュート切り替えエラー:', error);
    }
  }, [stream]);

  return {
    context,
    channel,
    person,
    stream,
    connect,
    disconnect,
    isConnected: !!person,
    participants,
    isMuted,
    toggleMute,
  };
};
