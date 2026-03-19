import { useRef, useState } from 'react';

/**
 * Records only the chat-shell element using the Region Capture API
 * (CropTarget.fromElement — Chrome 104+).
 * Falls back to full-tab capture on unsupported browsers.
 *
 * @param {{ targetRef: React.RefObject }} props
 */
export default function RecordButton({ targetRef }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  async function startRecording() {
    setError('');
    try {
      // --- Step 1: Create CropTarget from the element BEFORE getDisplayMedia ---
      // (Must happen first — browser registers the element as a crop target)
      let cropTarget = null;
      if (typeof CropTarget !== 'undefined' && targetRef.current) {
        cropTarget = await CropTarget.fromElement(targetRef.current);
      }

      // --- Step 2: Capture current tab (preferCurrentTab skips the picker) ---
      const displayMediaOptions = {
        preferCurrentTab: true,        // Chrome 107+ — skips share dialog, auto-picks this tab
        video: { frameRate: 30 },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      streamRef.current = stream;

      // --- Step 3: Crop the video track to the chat element ---
      const [track] = stream.getVideoTracks();
      if (cropTarget && typeof track.cropTo === 'function') {
        await track.cropTo(cropTarget);
      }

      // --- Step 4: Record the cropped stream ---
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `roast-battle-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      // Auto-stop if user ends the share via browser UI
      track.onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
        setRecording(false);
      };

      recorder.start(200);
      setRecording(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Recording failed: ' + err.message);
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <div className="record-wrapper">
      <button
        className={`btn-record ${recording ? 'recording' : ''}`}
        onClick={recording ? stopRecording : startRecording}
        title={recording ? 'Stop recording' : 'Record for Shorts'}
      >
        {recording ? (
          <>
            <span className="rec-dot" />
            Stop
          </>
        ) : (
          <>
            <span className="rec-icon">⏺</span>
            Record
          </>
        )}
      </button>
      {error && <div className="rec-error">{error}</div>}
    </div>
  );
}
