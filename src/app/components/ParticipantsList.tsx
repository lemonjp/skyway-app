import type { Member } from '@skyway-sdk/core';

type ParticipantsListProps = {
  participants: Member[];
};

export const ParticipantsList = ({ participants }: ParticipantsListProps) => {
  console.log('Rendering ParticipantsList with:', participants); // デバッグ用
  console.log('Participants details:', participants.map(p => ({
    id: p.id,
    name: p.name,
    state: p.state,
    side: p.side
  }))); // デバッグ用

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">参加者一覧 ({participants.length}人)</h2>
      <ul className="space-y-2">
        {participants.map((participant) => (
          <li key={participant.id} className="flex items-center">
            <span className="text-sm">
              {participant.name || '名前なし'}
              {participant.side === 'local' && ' (自分)'}
              {/* デバッグ用 */}
              <span className="text-gray-500 text-xs ml-2">
                (state: {participant.state})
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
