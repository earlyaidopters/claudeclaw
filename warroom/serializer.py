"""
Raw PCM serializer for the War Room WebSocket transport.

The browser sends raw 16-bit little-endian PCM (mono, 16000 Hz) over WebSocket.
Gemini Live sends back raw 16-bit PCM at 24000 Hz.

This serializer bridges both directions so pipecat can receive and send audio
without a telephony-platform serializer.
"""

from pipecat.frames.frames import Frame, InputAudioRawFrame, OutputAudioRawFrame
from pipecat.serializers.base_serializer import FrameSerializer


class RawPCMSerializer(FrameSerializer):
    """
    Bidirectional raw PCM serializer for browser ↔ pipecat audio.

    Inbound  (browser → pipecat): raw bytes → InputAudioRawFrame
    Outbound (pipecat → browser): OutputAudioRawFrame → raw bytes
    """

    def __init__(self, sample_rate: int = 16000, num_channels: int = 1):
        super().__init__()
        self._sample_rate = sample_rate
        self._num_channels = num_channels

    async def serialize(self, frame: Frame) -> bytes | None:
        if self.should_ignore_frame(frame):
            return None
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        if not isinstance(data, bytes) or len(data) == 0:
            return None
        return InputAudioRawFrame(
            audio=data,
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
        )
