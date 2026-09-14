# Hardware commissioning

This phase starts only after the real cameras and microphones are connected. Open `http://<LINKPI_IP>:8787` and follow the LinkPi Companion Guide in order. Until commissioning is complete, keep Auto Director in `OFF` or `DRY_RUN`.

## 1. Identify the real inputs

Target capture chain currently planned:

- Camera A: Blackmagic camera through SDI → HDMI into LinkPi HDMI input.
- Camera B: DJI Osmo Pocket 3 through the LinkPi USB/UVC path.

Confirm with `enc.getInputState` which channels are actually available, their sample rates and the negotiated video modes. Do not assume the Pocket 3 mode from desktop behavior.

Use the official 12 V / 2 A LinkPi supply during USB-camera tests. USB-camera stability and reconnect behavior were improved in recent firmware, but the real device must be soak-tested.

## 2. Decide microphone transport

Auto Director needs two independently observable detector signals. Supported target patterns include:

- A and B arrive on separate Encoder channels; or
- one stereo source carries Mic A on L and Mic B on R.

The final program audio must remain A + B regardless of the selected camera. Detection paths and program MixA routing are deliberately separate concepts.

Do not enable AUTO if both speakers cannot be distinguished in `enc.getVolume()` telemetry.

## 3. Calibrate A and B

For each microphone, capture representative:

1. room/silence level;
2. normal conversational speech;
3. louder speech/laughter;
4. the other speaker talking while this mic is nominally silent.

Store independent `noiseFloor` and `speechReference` values. Verify the normalized score stays near 0 during room noise and rises decisively during the intended speaker's speech.

## 4. Create dedicated native layouts

Create three dedicated layouts without reusing stock IDs:

- `CAM_A`: A full frame;
- `CAM_B`: B full frame;
- `SPLIT`: both cameras visible.

Validate crop/position with the real framing, then record the three layout IDs in `hardware.json`. Configure the Carousel sequence A → B → SPLIT and verify `carousel.getState()` can identify the currently active item.

Keep scene audio fixed to the program mix. Rotating video layouts must not rewrite which microphones are heard.

## 5. DRY_RUN conversation test

Run at least 20–30 minutes of normal conversation in `DRY_RUN` and inspect:

- clean A→B handoffs;
- short “oui / mhm” backchannels;
- interruptions;
- laughter and crosstalk;
- long monologues;
- silence;
- impulsive table/handling noise.

Tune the UI timings only from observed behavior. Start with the Natural preset; to reduce ping-pong, increase **minimum shot** and **refractory period** before making acquisition excessively slow.

## 6. AUTO test without public streaming

Only when every readiness gate is green:

1. arm AUTO;
2. record locally first;
3. verify every cut leaves program audio continuous;
4. verify no Encoder reload and no recording interruption occurs;
5. force a source loss/reconnect and confirm fail-safe behavior;
6. run an extended soak test.

## 7. Production streaming/recording

Use the Companion Streaming step to construct and validate RTMP/RTMPS, SRT or RTP/UDP values, then copy them into the native LinkPi Push/Stream page. During this phase Companion remains read-only for production stream/record configuration.

The recording target is CAM A + CAM B + PROGRAM in MP4 on external USB storage while PROGRAM is streamed. Do not mark that workflow READY until the three simultaneous recordings have been benchmarked with real hardware.

### Encode/load validation

After Auto Director itself is stable, measure the actual encode budget for:

- Camera A ISO;
- Camera B ISO;
- Program Mix;
- simultaneous YouTube/Twitch push.

Choose frame rate, bitrate, codec, container and A/V delay from those measurements rather than pre-hardware assumptions.
