import {useEffect, useRef} from 'react';
import {Internals} from 'remotion';
import {calculateNextFrame} from './calculate-next-frame';
import {usePlayer} from './use-player';

// TODO: validate
const ABSOLUTE_MAX_PLAYBACKSPEED = 4;

export const usePlayback = ({
	loop,
	playbackRate,
}: {
	loop: boolean;
	playbackRate: number;
}) => {
	const frame = Internals.Timeline.useTimelinePosition();
	const config = Internals.useUnsafeVideoConfig();
	const {playing, pause, emitter} = usePlayer();
	const setFrame = Internals.Timeline.useTimelineSetFrame();
	const {inFrame, outFrame} =
		Internals.Timeline.useTimelineInOutFramePosition();

	const playbackChangeTime = useRef<number>();
	const frameRef = useRef(frame);
	frameRef.current = frame;

	const lastTimeUpdateEvent = useRef<number | null>(null);

	useEffect(() => {
		if (!config) {
			return;
		}

		if (!playing) {
			return;
		}

		let hasBeenStopped = false;
		let reqAnimFrameCall: number | null = null;
		const startedTime = performance.now();
		let framesAdvanced = 0;

		const stop = () => {
			hasBeenStopped = true;
			playbackChangeTime.current = undefined;
			if (reqAnimFrameCall !== null) {
				cancelAnimationFrame(reqAnimFrameCall);
			}
		};

		const callback = (now: DOMHighResTimeStamp) => {
			const time = now - startedTime;
			const actualLastFrame = outFrame ?? config.durationInFrames - 1;
			const actualFirstFrame = inFrame ?? 0;

			const {nextFrame, framesToAdvance, hasEnded} = calculateNextFrame({
				time,
				currentFrame: frameRef.current,
				playbackSpeed: playbackRate,
				fps: config.fps,
				actualFirstFrame,
				actualLastFrame,
				framesAdvanced,
				shouldLoop: loop,
			});
			framesAdvanced += framesToAdvance;

			if (nextFrame !== frameRef.current) {
				setFrame(nextFrame);
			}

			if (hasEnded) {
				stop();
				pause();
				emitter.dispatchEnded();
				return;
			}

			if (!hasBeenStopped) {
				reqAnimFrameCall = requestAnimationFrame(callback);
			}
		};

		reqAnimFrameCall = requestAnimationFrame(callback);

		return () => {
			stop();
		};
	}, [
		config,
		loop,
		pause,
		playing,
		setFrame,
		emitter,
		playbackRate,
		inFrame,
		outFrame,
	]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (lastTimeUpdateEvent.current === frameRef.current) {
				return;
			}

			emitter.dispatchTimeUpdate({frame: frameRef.current as number});
			lastTimeUpdateEvent.current = frameRef.current;
		}, 250);

		return () => clearInterval(interval);
	}, [emitter]);
};
