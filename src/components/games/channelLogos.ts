export interface ChannelInfo {
  id: string;
  name: string;
  logo: string;
}

export const CHANNELS: ChannelInfo[] = [
  { id: "globo", name: "Globo", logo: "/channels/globo.png" },
  { id: "sportv", name: "SporTV", logo: "/channels/sportv.png" },
  { id: "premiere", name: "Premiere", logo: "/channels/premiere.png" },
  { id: "espn", name: "ESPN", logo: "/channels/espn.png" },
  { id: "star_plus", name: "Star+", logo: "/channels/star_plus.png" },
  { id: "amazon", name: "Prime Video", logo: "/channels/amazon.png" },
  { id: "cazetv", name: "CazéTV", logo: "/channels/cazetv.png" },
  { id: "band", name: "Band", logo: "/channels/band.png" },
  { id: "record", name: "Record", logo: "/channels/record.png" },
  { id: "paramount", name: "Paramount+", logo: "/channels/paramount.png" },
  { id: "tnt_sports", name: "TNT Sports", logo: "/channels/tnt_sports.png" },
  { id: "disney_plus", name: "Disney+", logo: "/channels/disney_plus.png" },
];

export const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.id, c]));
