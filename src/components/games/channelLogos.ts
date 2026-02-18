export interface ChannelInfo {
  id: string;
  name: string;
  logo: string;
}

export const CHANNELS: ChannelInfo[] = [
  { id: "globo", name: "Globo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/TV_Globo_logo.svg/200px-TV_Globo_logo.svg.png" },
  { id: "sportv", name: "SporTV", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/SporTV_2021.svg/200px-SporTV_2021.svg.png" },
  { id: "premiere", name: "Premiere", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Premiere_Futebol_Clube.svg/200px-Premiere_Futebol_Clube.svg.png" },
  { id: "espn", name: "ESPN", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/200px-ESPN_wordmark.svg.png" },
  { id: "star_plus", name: "Star+", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Disney%2B_logo.svg/200px-Disney%2B_logo.svg.png" },
  { id: "amazon", name: "Prime Video", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo.svg/200px-Amazon_Prime_Video_logo.svg.png" },
  { id: "cazetv", name: "CazéTV", logo: "https://yt3.googleusercontent.com/grfYfEgqHxPqLmwFoNJRLWsA4PjR-gmnq1K-YBYuMKCL-maQ93WqJKfJKKl8YcmRFP--O8fOzQ=s200" },
  { id: "band", name: "Band", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Rede_Bandeirantes_logo_2017.svg/200px-Rede_Bandeirantes_logo_2017.svg.png" },
  { id: "record", name: "Record", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/RecordTV_logo.svg/200px-RecordTV_logo.svg.png" },
  { id: "paramount", name: "Paramount+", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/200px-Paramount_Plus.svg.png" },
];

export const CHANNEL_MAP = Object.fromEntries(CHANNELS.map(c => [c.id, c]));
