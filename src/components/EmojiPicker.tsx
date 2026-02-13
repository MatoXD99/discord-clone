import React from "react";

// Lightweight emoji picker - common emojis
const EMOJIS = [
    "😀", "😂", "❤️", "😍", "🔥", "👍", "🎉", "😢",
    "😡", "😴", "🤔", "👏", "🙌", "🎊", "✨", "🌟",
    "💯", "🎵", "🎸", "🍕", "🍔", "🌮", "🍜", "☕",
    "🏀", "⚽", "🎮", "📱", "💻", "🎨", "📸", "🎬",
];

type EmojiPickerProps = {
    onEmojiSelect: (emoji: string) => void;
    isOpen: boolean;
    onClose: () => void;
};

export default function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop to close picker */}
            <div
                className="fixed inset-0 z-30"
                onClick={onClose}
            ></div>

            {/* Emoji grid */}
            <div className="absolute bottom-16 right-0 bg-gray-750 border border-gray-700 rounded-lg p-3 grid grid-cols-8 gap-2 z-40 w-80">
                {EMOJIS.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => {
                            onEmojiSelect(emoji);
                            onClose();
                        }}
                        className="text-2xl hover:bg-gray-700 p-2 rounded transition-colors cursor-pointer"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </>
    );
}
