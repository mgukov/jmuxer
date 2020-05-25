"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JMuxmer = exports.VideoChunks = void 0;
const debug = __importStar(require("./util/debug"));
const nalu_js_1 = require("./util/nalu.js");
const h264_js_1 = require("./parsers/h264.js");
const aac_js_1 = require("./parsers/aac.js");
const event_1 = require("./util/event");
const remux_js_1 = __importDefault(require("./controller/remux.js"));
const buffer_js_1 = __importDefault(require("./controller/buffer.js"));
class VideoChunks {
    constructor() {
        this.video = [];
        this.audio = [];
    }
}
exports.VideoChunks = VideoChunks;
class JMuxmer extends event_1.Event {
    constructor(options) {
        super('jmuxer');
        this.sourceBuffers = new Map();
        this.remuxController = null;
        this.mseReady = false;
        this.lastCleaningTime = Date.now();
        this.keyframeCache = [];
        this.frameCounter = 0;
        this.mediaSource = null;
        this.videoStarted = false;
        this.bufferControllers = new Map();
        this.bufferStarted = false;
        const defaults = {
            node: '',
            mode: 'both',
            flushingTime: 1500,
            clearBuffer: true,
            onReady: null,
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
        this.remuxController = new remux_js_1.default(this.options.clearBuffer);
        this.remuxController.addTrack(this.options.mode);
        /* events callback */
        this.remuxController.on('buffer', this.onBuffer.bind(this));
        this.remuxController.on('ready', this.createBuffer.bind(this));
        this.startInterval();
    }
    static isSupported(codec) {
        return (MediaSource.isTypeSupported(codec));
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
    feed(data) {
        var _a;
        let remux = false, nalus, aacFrames, duration, chunks = new VideoChunks();
        if (!data || !this.remuxController)
            return;
        duration = (_a = data.duration) !== null && _a !== void 0 ? _a : 0;
        if (data.video) {
            nalus = h264_js_1.H264Parser.extractNALu(data.video);
            if (nalus.length > 0) {
                chunks.video = this.getVideoFrames(nalus, duration);
                remux = true;
            }
        }
        if (data.audio) {
            aacFrames = aac_js_1.AACParser.extractAAC(data.audio);
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
    getVideoFrames(nalus, duration) {
        let nalu, units = [], samples = [], naluObj, sampleDuration = 0, adjustDuration = 0, numberOfFrames = [];
        for (nalu of nalus) {
            naluObj = new nalu_js_1.NALU(nalu);
            units.push(naluObj);
            if (naluObj.type() === nalu_js_1.NALU.IDR || naluObj.type() === nalu_js_1.NALU.NDR) {
                samples.push({ units, duration: 0 });
                units = [];
                if (this.options.clearBuffer) {
                    if (naluObj.type() === nalu_js_1.NALU.IDR) {
                        numberOfFrames.push(this.frameCounter);
                    }
                    this.frameCounter++;
                }
            }
        }
        if (duration > 0) {
            sampleDuration = duration / samples.length;
            adjustDuration = (duration - (sampleDuration * samples.length));
        }
        else {
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
    getAudioFrames(aacFrames, duration) {
        let samples = [], units, sampleDuration = 0, adjustDuration = 0;
        for (units of aacFrames) {
            samples.push({ units, duration: 0 });
        }
        if (duration) {
            sampleDuration = duration / samples.length | 0;
            adjustDuration = (duration - (sampleDuration * samples.length));
        }
        else {
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
            }
            catch (e) {
                debug.error(`mediasource is not available to end ${e.message}`);
            }
            this.mediaSource = null;
        }
        if (this.remuxController) {
            this.remuxController.destroy();
            this.remuxController = null;
        }
        for (let type in this.bufferControllers) {
            const ctrl = this.bufferControllers.get(type);
            if (ctrl) {
                ctrl.destroy();
            }
        }
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
        for (let t in this.remuxController.tracks.keys()) {
            const type = t;
            let track = this.remuxController.tracks.get(type);
            if (!track) {
                continue;
            }
            if (!JMuxmer.isSupported(`${type}/mp4; codecs="${track.mp4track.codec}"`)) {
                debug.error('Browser does not support codec');
                return false;
            }
            if (this.mediaSource) {
                let sb = this.mediaSource.addSourceBuffer(`${type}/mp4; codecs="${track.mp4track.codec}"`);
                this.bufferControllers.set(type, new buffer_js_1.default(sb, type));
                this.sourceBuffers.set(type, sb);
                const ctrl = this.bufferControllers.get(type);
                if (ctrl) {
                    ctrl.on('error', this.onBufferError.bind(this));
                }
            }
        }
    }
    startInterval() {
        this.interval = setInterval(() => {
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
        for (let type in this.bufferControllers) {
            const ctrl = this.bufferControllers.get(type);
            if (ctrl) {
                ctrl.doAppend();
            }
        }
    }
    getSafeBufferClearLimit(offset) {
        let maxLimit = (this.options.mode === 'audio' && offset) || 0, adjacentOffset = 0;
        for (let i = 0; i < this.keyframeCache.length; i++) {
            if (this.keyframeCache[i] >= offset) {
                break;
            }
            adjacentOffset = this.keyframeCache[i];
        }
        if (adjacentOffset) {
            this.keyframeCache = this.keyframeCache.filter(keyframePoint => {
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
            for (let type in this.bufferControllers) {
                let cleanMaxLimit = this.getSafeBufferClearLimit(this.node.currentTime);
                const ctrl = this.bufferControllers.get(type);
                if (ctrl) {
                    ctrl.initCleanup(cleanMaxLimit);
                }
            }
            this.lastCleaningTime = Date.now();
        }
    }
    onBuffer(data) {
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
    onBufferError(data) {
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
            }
            catch (e) {
                debug.error('mediasource is not available to end');
            }
        }
    }
}
exports.JMuxmer = JMuxmer;
//# sourceMappingURL=jmuxer.js.map