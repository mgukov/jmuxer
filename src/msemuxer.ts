import * as debug from './util/debug';
import { NALU } from './util/nalu.js';
import { H264Parser } from './parsers/h264.js';
import { AACParser } from './parsers/aac.js';
import { Event } from './util/event';
import RemuxController, {TrackType, VideoChunks} from './controller/remux.js';
import BufferController from './controller/buffer.js';

export type MseMuxmerOptions = {
    node: HTMLVideoElement,
    mode: TrackType, // both, audio, video
    flushingTime: number,
    clearBuffer: boolean,
    onReady?: (() => void)|null, // function called when MSE is ready to accept frames
    fps: number,
    debug: boolean
};

export type MediaData = {
    video?:Uint8Array;
    audio?:Uint8Array;
    duration?:number;
};


export class MseMuxmer extends Event {

    static isSupported(codec:string) {
        return (MediaSource.isTypeSupported(codec));
    }

    private readonly options: MseMuxmerOptions;
    private readonly frameDuration:number;
    private node: HTMLVideoElement|null;

    private readonly sourceBuffers = new Map<TrackType, any>();
    private remuxController:RemuxController|null = null;
    private mseReady = false;
    private lastCleaningTime = Date.now();
    private keyframeCache:number[] = [];
    private frameCounter = 0;

    private mediaSource: MediaSource|null = null;
    private videoStarted = false;
    private readonly bufferControllers = new Map<TrackType, BufferController>();
    private bufferStarted = false;

    private interval: any;

    constructor(options:MseMuxmerOptions) {
        super('jmuxer');

        const defaults = {
            node: '',
            mode: 'both', // both, audio, video
            flushingTime: 1500,
            clearBuffer: true,
            onReady: null, // function called when MSE is ready to accept frames
            fps: 30,
            debug: false
        };

        this.options = Object.assign({}, defaults, options);
        if (this.options.debug) {
            debug.setLogger();
        }

        if (typeof this.options.node === 'string' && this.options.node == '') {
            debug.error('no video element were found to render, provide a valid video element');
        }

        if (!this.options.fps) {
            this.options.fps = 30;
        }
        this.frameDuration = (1000 / this.options.fps) | 0;
        this.node = this.options.node;

        const isMSESupported = !!window.MediaSource;
        if (!isMSESupported) {
            throw 'Oops! Browser does not support media source extension.';
        }

        this.setupMSE();
        this.remuxController = new RemuxController(this.options.clearBuffer);
        this.remuxController.addTrack(this.options.mode);


        /* events callback */
        this.remuxController.on('buffer', this.onBuffer.bind(this));
        this.remuxController.on('ready', this.createBuffer.bind(this));
        this.startInterval();
    }

    setupMSE() {
        this.mediaSource = new MediaSource();
        if (this.node) {
            this.node.src = URL.createObjectURL(this.mediaSource);
        }
        this.mediaSource.addEventListener('sourceopen', this.onMSEOpen.bind(this));
        this.mediaSource.addEventListener('sourceclose', this.onMSEClose.bind(this));
        this.mediaSource.addEventListener('webkitsourceopen', this.onMSEOpen.bind(this));
        this.mediaSource.addEventListener('webkitsourceclose', this.onMSEClose.bind(this));
    }

    feed(data: MediaData) {
        let remux = false,
            nalus,
            aacFrames,
            duration,
            chunks = new VideoChunks();

        if (!data || !this.remuxController) return;
        duration = data.duration ?? 0;
        if (data.video) {
            nalus = H264Parser.extractNALu(data.video);
            if (nalus.length > 0) {
                chunks.video = this.getVideoFrames(nalus, duration);
                remux = true;
            }
        }
        if (data.audio) {
            aacFrames = AACParser.extractAAC(data.audio);
            if (aacFrames.length > 0) {
                chunks.audio = this.getAudioFrames(aacFrames, duration);
                remux = true;
            }
        }
        if (!remux) {
            debug.error('Input object must have video and/or audio property. Make sure it is not empty and valid typed array');
            return;
        }
        this.remuxController.remux(chunks);
    }

    getVideoFrames(nalus:Uint8Array[], duration:number) {
        let nalu,
            units = [],
            samples = [],
            naluObj,
            sampleDuration = 0,
            adjustDuration = 0,
            numberOfFrames:number[] = [];

        for (nalu of nalus) {
            naluObj = new NALU(nalu);
            units.push(naluObj);
            if (naluObj.type() === NALU.IDR || naluObj.type() === NALU.NDR) {
                samples.push({units, duration: 0});
                units = [];
                if (this.options.clearBuffer) {
                    if (naluObj.type() === NALU.IDR) {
                        numberOfFrames.push(this.frameCounter);
                    }
                    this.frameCounter++;
                }
            }
        }

        if (duration > 0) {
            sampleDuration = duration / samples.length;
            adjustDuration = (duration - (sampleDuration * samples.length));
        } else {
            sampleDuration = this.frameDuration;
        }
        samples.map(sample => {
            sample.duration = adjustDuration > 0 ? (sampleDuration + 1) : sampleDuration;
            if (adjustDuration !== 0) {
                adjustDuration--;
            }
        });

        /* cache keyframe times if clearBuffer set true */
        if (this.options.clearBuffer) {
            numberOfFrames = numberOfFrames.map((total) => {
                return (total * sampleDuration) / 1000;
            });
            this.keyframeCache = this.keyframeCache.concat(numberOfFrames);
        }
        return samples;
    }

    getAudioFrames(aacFrames:Uint8Array[], duration:number) {
        let samples = [],
            units,
            sampleDuration = 0,
            adjustDuration = 0;

        for (units of aacFrames) {
            samples.push({units, duration:0});
        }

        if (duration) {
            sampleDuration = duration / samples.length | 0;
            adjustDuration = (duration - (sampleDuration * samples.length));
        } else {
            sampleDuration = this.frameDuration;
        }
        samples.map((sample) => {
            sample.duration = adjustDuration > 0 ? (sampleDuration + 1) : sampleDuration;
            if (adjustDuration !== 0) {
                adjustDuration--;
            }
        });
        return samples;
    }

    destroy() {
        this.stopInterval();
        if (this.mediaSource) {
            try {
                if (this.bufferControllers) {
                    this.mediaSource.endOfStream();
                }
            } catch (e) {
                debug.error(`mediasource is not available to end ${e.message}`);
            }
            this.mediaSource = null;
        }
        if (this.remuxController) {
            this.remuxController.destroy();
            this.remuxController = null;
        }
        this.bufferControllers.forEach(ctrl => {
            ctrl.destroy();
        });
        this.bufferControllers.clear();
        this.node = null;
        this.mseReady = false;
        this.videoStarted = false;
        this.bufferStarted = false;
    }

    createBuffer() {

        if (!this.mseReady || !this.remuxController || !this.remuxController.isReady() || this.bufferStarted) {
            return;
        }

        this.bufferControllers.clear();
        this.remuxController.tracks.forEach((value, type) => {
            let track = this.remuxController!.tracks.get(type);
            if (!track) {
                return;
            }

            if (!MseMuxmer.isSupported(`${type}/mp4; codecs="${track.mp4track.codec}"`)) {
                debug.error('Browser does not support codec');
                return false;
            }

            if (this.mediaSource) {
                let sb = this.mediaSource.addSourceBuffer(`${type}/mp4; codecs="${track.mp4track.codec}"`);
                this.bufferControllers.set(type, new BufferController(sb, type));
                this.sourceBuffers.set(type, sb);
                const ctrl = this.bufferControllers.get(type);
                if (ctrl) {
                    ctrl.on('error', this.onBufferError.bind(this));
                }
            }
        });
    }

    startInterval() {
        this.interval = setInterval(()=>{
            if (this.bufferControllers) {
                this.releaseBuffer();
                this.clearBuffer();
            }
        }, this.options.flushingTime);
    }

    stopInterval() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    releaseBuffer() {
        this.bufferControllers.forEach(ctrl => {
            ctrl.doAppend();
        });
    }

    getSafeBufferClearLimit(offset:number) {
        let maxLimit = (this.options.mode === 'audio' && offset) || 0,
            adjacentOffset = 0;

        for (let i = 0; i < this.keyframeCache.length; i++) {
            if (this.keyframeCache[i] >= offset) {
                break;
            }
            adjacentOffset = this.keyframeCache[i];
        }

        if (adjacentOffset) {
            this.keyframeCache = this.keyframeCache.filter( keyframePoint => {
                if (keyframePoint < adjacentOffset) {
                    maxLimit = keyframePoint;
                }
                return keyframePoint >= adjacentOffset;
            });
        }

        return maxLimit;
    }

    clearBuffer() {
        if (this.options.clearBuffer && (Date.now() - this.lastCleaningTime) > 10000) {
            this.bufferControllers.forEach(ctrl => {
                let cleanMaxLimit = this.getSafeBufferClearLimit(this.node!.currentTime);
                ctrl.initCleanup(cleanMaxLimit);
            });
            this.lastCleaningTime = Date.now();
        }
    }

    onBuffer(data:any) {
        const ctrl = this.bufferControllers.get(data.type);
        if (ctrl) {
            ctrl.feed(data.payload);
        }
    }

    /* Events on MSE */
    onMSEOpen() {
        this.mseReady = true;
        if (typeof this.options.onReady === 'function') {
            this.options.onReady();
            this.options.onReady = null;
        }
        this.createBuffer();
    }

    onMSEClose() {
        this.mseReady = false;
        this.videoStarted = false;
    }

    onBufferError(data:any) {
        if (data.name == 'QuotaExceeded') {
            const ctrl = this.bufferControllers.get(data.type);
            if (ctrl && this.node) {
                ctrl.initCleanup(this.node.currentTime);
            }
            return;
        }

        if (!this.mediaSource) {
            return;
        }

        const buffer = this.sourceBuffers.get(data.type);

        if (this.mediaSource.sourceBuffers.length > 0 && buffer) {
            this.mediaSource.removeSourceBuffer(buffer);
        }

        if (this.mediaSource.sourceBuffers.length == 0) {
            try {
                this.mediaSource.endOfStream();
            } catch (e) {
                debug.error('mediasource is not available to end');
            }
        }
    }
}
