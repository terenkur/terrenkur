'use client';

import EventLog from './EventLog';
import TwitchVideos from './TwitchVideos';
import TwitchClips from './TwitchClips';

export default function ActivityContent() {
  return (
    <>
      <EventLog />
      <TwitchVideos />
      <TwitchClips />
    </>
  );
}
