type MuteButtonProps = {
  isMuted: boolean;
  onToggle: () => void;
};

export const MuteButton = ({ isMuted, onToggle }: MuteButtonProps) => {
  return (
    <button
      onClick={onToggle}
      className={`px-4 py-2 rounded ${
        isMuted
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-green-500 hover:bg-green-600'
      } text-white`}
    >
      {isMuted ? 'ミュート解除' : 'ミュート'}
    </button>
  );
};
