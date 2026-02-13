export type ServerItem = {
  id: string;
  name: string;
  label: string;
};

export type ChannelItem = {
  id: string;
  name: string;
  serverId: string;
};

export type MemberItem = {
  id: string;
  name: string;
};

export type MessageItem = {
  id: string;
  channelId: string;
  author: string;
  text: string;
  time: string;
};
