// 테스트와 개발용 가짜 mp3: 무음 MPEG-1 Layer III 프레임(128kbps, 44.1kHz)을 이어 붙인다.
export function makeMp3(frames = 20): Uint8Array {
  const frameSize = 417;
  const bytes = new Uint8Array(frames * frameSize);
  for (let i = 0; i < frames; i++) {
    bytes.set([0xff, 0xfb, 0x90, 0x00], i * frameSize);
  }
  return bytes;
}
