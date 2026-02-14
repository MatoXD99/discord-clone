import type { Socket } from "socket.io-client";

declare type VoiceChannelProps = {
    socket: Socket;
    isLakeHouse: boolean;
};

declare const VoiceChannel: (props: VoiceChannelProps) => JSX.Element | null;

export default VoiceChannel;
