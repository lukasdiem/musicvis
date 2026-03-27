/*
 * This Audio Player is based on the following sources:
 * http://airtightinteractive.com/demos/js/reactive/ - A great WebAudioAPI example
 * http://jeromeetienne.github.com/slides/webaudioapi/#1 - A great slideshow on the basic elements of the WebAudioAPI 
 *
 */

/**
 * Bind the method to the right scope ...
 * http://stackoverflow.com/questions/1663553/javascript-object-method-name-for-settimeout 
 * http://www.pagecolumn.com/javascript/settimeout.htm
 * 
 * @this{AudioPlayer}
 * @param method the method that has to be put into the right scope (like: this.loadSampleAudio)
 * @returns returns the method in the correct scope
 */
AudioPlayer.prototype.bind = function(method) {
	var _this = this;
	 
	return(
		function(){
			return (method.apply(_this, arguments));
		}
	);
}

function setButtonDisabled(buttonId, disabled) {
	var button = document.getElementById(buttonId);
	if (button) {
		button.disabled = !!disabled;
	}
}


/**
 * Creates an instance of the class AudioPlayer.
 * This class can be used to easily playback songs with the experimental Web Audio API from Chrome (see https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html for Details)
 * 
 * @constructor
 * @this{AudioPlayer} 
 */ 
function AudioPlayer() {
	// Get the Audio Context from the browser (WebAudioAPI must be supported therefore)
	var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
	this.audioContext = AudioContextCtor ? new AudioContextCtor() : null;
	this.audioAnalyzer;
	this.audioProcessor;
	this.audioSource;
	this.audioBuffer;
	
	this.freqCnt = 512;	
	this.freqByteData;
	
	this.isPlaying = false;
	this.isInitialized = false;
	this.isStopped = false;
	
	// Vars needed for the visualization of the frequency histogram
	this.canvas;
	this.canvasCtx;
	this.stopRendering = false;

	if (!this.audioContext) {
		console.error("Web Audio API is not supported in this browser.");
		setButtonDisabled("btnPlay", true);
		setButtonDisabled("btnStop", true);
	}
}

/**
 * Loads a sample audio file from the folder audio
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.loadSampleAudio = function() {
	if (!this.audioContext) {
		return;
	}

	console.log("Loading sample audio file ...");

	// Load the sample file
	this.loadFromURL("audio/test.mp3");
}

/**
 * Loads a *.mp3 file from the given URL and invokes it's playback.
 * 
 * @this{AudioPlayer} 
 * @param {string} url The URL to the *.mp3 file
 */
AudioPlayer.prototype.loadFromURL = function(url) {
	if (!this.audioContext) {
		return;
	}

	console.log("Loading Audio File from: " + url);

	// Disable the buttons
	setButtonDisabled("btnPlay", true);
	setButtonDisabled("btnStop", true);
	
	// Save my instance for the callback
	var myself = this;
	
	// init request
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    // needed to process the audiostream!!!
    request.responseType = 'arraybuffer';

    // function called once data is loaded
    request.onload = function(){
		if (request.status !== 200 && request.status !== 0) {
			console.error("Audio request failed with status " + request.status + " for " + url);
			return;
		}
        // Initialize the audiobuffer
       myself.initAudioBuffer(request.response);
    }

	request.onerror = function() {
		console.error("Audio request failed for " + url);
	};

    request.send();	// Start the request
}

/**
 * Initializes the AudioSource and therefore the AudioSource.buffer with the given data.
 * 
 * @this{AudioPlayer} 
 * @param {arraybuffer} data can be an arraybuffer from an XMLHttpRequest or an already decoded buffer array 
 */
AudioPlayer.prototype.initAudioBuffer = function(data) {
	if (!this.audioContext) {
		return;
	}

	// Save my instance
	var myself = this;

	if (!this.audioContext.decodeAudioData) {
		console.error("decodeAudioData is not available in this browser.");
		return;
	}

	var onDecoded = function(buffer) {
		myself.audioBuffer = buffer;
		myself.addBufferToSource(myself.audioBuffer);
		myself.createAudio();
	};

	var onError = function(e) {
		console.error("Could not decode audio data.", e);
	};

	// Newer browsers return a Promise, older implementations use callbacks.
	try {
		var decodePromise = this.audioContext.decodeAudioData(data);
		if (decodePromise && typeof decodePromise.then === "function") {
			decodePromise.then(onDecoded).catch(onError);
			return;
		}
	} catch (promiseDecodeError) {
		// Fall back to callback style below.
	}

	this.audioContext.decodeAudioData(data, onDecoded, onError);
}


AudioPlayer.prototype.addBufferToSource = function(buffer) {
	if (!this.audioContext) {
		return;
	}

	// Disable the buttons, because I am disabling all playing songs (if there are any ;))
	setButtonDisabled("btnPlay", true);
	setButtonDisabled("btnStop", true);
	
	//clean up previous mp3
	if (this.audioSource) this.audioSource.disconnect();
		
	// initialize a new buffered source
	this.audioSource = this.audioContext.createBufferSource();
	// loop the song
	this.audioSource.loop = true;
	this.audioSource.buffer = buffer;
	
	console.log("Finished loading MP3-file");
	
	setButtonDisabled("btnPlay", false);
}

/**
 * Attach all needed audio nodes and start the playback
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.createAudio = function() {	
	if (!this.audioContext || !this.audioSource) {
		return;
	}

	// Create the routing of the modules
	this.audioProcessor = null;
	if (this.audioContext.createScriptProcessor) {
		this.audioProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
	} else if (this.audioContext.createJavaScriptNode) {
		this.audioProcessor = this.audioContext.createJavaScriptNode(2048, 1, 1);
	}

	// Create an analyzer from the audio context
	this.audioAnalyzer = this.audioContext.createAnalyser();
	this.audioAnalyzer.fftSize = this.freqCnt;
	//this.audioAnalyzer.smoothingTimeConstant = 0.8;
	// Initialize the frequency data array needed for the frequency analysis
	this.freqByteData = new Uint8Array(this.audioAnalyzer.frequencyBinCount);

	this.audioSource.connect(this.audioAnalyzer);
	this.audioSource.connect(this.audioContext.destination);

	if (this.audioProcessor) {
		this.audioAnalyzer.connect(this.audioProcessor);
		this.audioProcessor.connect(this.audioContext.destination);
	}
}

AudioPlayer.prototype.startSource = function() {
	if (!this.audioSource) {
		return;
	}

	if (this.audioSource.start) {
		this.audioSource.start(0);
	} else if (this.audioSource.noteOn) {
		this.audioSource.noteOn(0);
	}
}

AudioPlayer.prototype.stopSource = function() {
	if (!this.audioSource) {
		return;
	}

	if (this.audioSource.stop) {
		this.audioSource.stop(0);
	} else if (this.audioSource.noteOff) {
		this.audioSource.noteOff(0);
	}
}

AudioPlayer.prototype.play = function() {
	if (!this.audioContext) {
		return;
	}

	var myself = this;
	var beginPlayback = function() {
		if (myself.isStopped === false) { // Play the song the first time => everything is already loaded
			myself.startSource();
			myself.isPlaying = true;
		} else { // Recreate the source and begin playing
			myself.addBufferToSource(myself.audioBuffer);
			myself.createAudio();
			myself.startSource();
			myself.isPlaying = true;
			myself.isStopped = false;
		}

		console.log("Playing the file");
		setButtonDisabled("btnPlay", true);
		setButtonDisabled("btnStop", false);
	};

	if (this.audioContext.state === "suspended" && this.audioContext.resume) {
		this.audioContext.resume().then(beginPlayback).catch(function(err) {
			console.error("Could not resume audio context.", err);
		});
	} else {
		beginPlayback();
	}
}

/**
 * Stop the playback of the audio signal forever :D 
 * 
 * @this{AudioPlayer}
 */
AudioPlayer.prototype.stop = function() {
	if (this.isPlaying === true) {
		this.stopSource();
		this.isPlaying = false;
		this.isStopped = true;
		
		console.log("Playing the file");
	
		setButtonDisabled("btnStop", true);
		setButtonDisabled("btnPlay", false);
	} else {
		// player is not playing
	}
}

/**
 * Get an histogram of the frequencies of the played audio signal.
 * The histogram is saved in a UINT8 Array.
 * 
 * @this{AudioPlayer} 
 * @returns {UINT8Array} freqByteData Returns a Byte Array with the actual frequency data of the audio which is playing 
 */
AudioPlayer.prototype.getByteFrequencyData = function() {
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.freqByteData;
	} else {
		var nullArray = new Uint8Array(1);
		return nullArray;
	}
}

AudioPlayer.prototype.getTransformedFreqData = function(k, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.transformArray(this.freqByteData, k, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.getTransformedFreqDataWithGain = function(k, gain, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteFrequencyData(this.freqByteData);
		return this.transformArrayWithGain(this.freqByteData, k, gain, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.getTransformedTimeDomainData = function(k, min, max) {	
	if (this.isPlaying === true) {
		this.audioAnalyzer.getByteTimeDomainData(this.freqByteData);
		return this.transformArray(this.freqByteData, k, min, max);
	} else {
		// If the sound is not playing return just 1s
		var transFreqData = new Float32Array(k);
		var i = 0;
		while (i<k)	transFreqData[i++]=1.0;
		
		return transFreqData;
	} 
}

AudioPlayer.prototype.transformArray = function(array, k, min, max) {
	// The transform ratio 
	var transRatio = k/array.length;
	var transArray = new Float32Array(k);
	
	var idx, gain;
	var arrLen = array.length;
	for (var i=0; i < array.length; i++) {
		idx = Math.min(k - 1, Math.round(i*transRatio));
		gain = (3*i*i)/(arrLen*arrLen);
		transArray[idx] += array[i] + array[i] * gain;
	}
	
	return scaleArray(transArray, 0, 255/transRatio, min, max);
}

AudioPlayer.prototype.transformArrayWithGain = function(array, k, gainval, min, max) {
	// The transform ratio 
	var transRatio = k/array.length;
	var transArray = new Float32Array(k);
	
	var idx, gain;
	var arrLen = array.length;
	for (var i=0; i < array.length; i++) {
		idx = Math.min(k - 1, Math.round(i*transRatio));
		gain = (gainval*i*i)/(arrLen*arrLen);
		transArray[idx] += array[i] + array[i] * gain;
	}
	
	return scaleArray(transArray, 0, 255/transRatio, min, max);
}

function scaleArray(hist, oldMin, oldMax, newMin, newMax) {
	/*
	// get min and max	
	// Get the maximum
	var oldMax = 0; 
	for(var i = 0; i<len; i++) if(hist[i] > oldMax) oldMax = hist[i];
	// Get the minimum
	var oldMin = hist[0];
	for(var i = 0; i<len; i++) if(hist[i] < oldMin) oldMin = hist[i];*/
	var len = hist.length;	
	var scaledHist = new Float32Array(len);
	//console.log("Max: " + oldMax + " Min: " + oldMin);
	
	for(var i=0; i<len; i++) {
		// Scale the values
		scaledHist[i] = (hist[i] - oldMin) * (newMax - newMin) / (oldMax-oldMin) + newMin;
	}
	
	return scaledHist;
}

/***************************************************
 * Frequency histogram on a canvas
 ***************************************************/

/**
 * Initialize the renderloop and canvas to display a Frequency histogram plot.
 * 
 * @this{AudioPlayer}
 * @param{canvas} canvas The canvas on which the Frequency histogram should be plotted.
 */ 
AudioPlayer.prototype.initFreqHist = function(canvas) {
	this.canvas = canvas;  
  	this.canvasCtx = canvas.getContext("2d");  
  	
  	// Start the reandering loop
  	this.renderLoop(); 
}

/**
 * The renderloop of the frequency histogram.
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.renderLoop = function() {			
	// render the frequency histogram
	this.renderFreqHist();
	
	// Do while stop rendering is set
	if (!this.stopRendering) {
		// Loop every 100 ms
		setTimeout(this.bind(this.renderLoop), 100);
	}
}

/**
 * The function to plot the frequency bins on the canvas.
 * This function should be called from the render loop!
 * 
 * @this{AudioPlayer} 
 */
AudioPlayer.prototype.renderFreqHist = function() {
	var canW = this.canvas.width;
	var canH = this.canvas.height;
	
	// Clear the canvas
	this.canvasCtx.clearRect(0, 0, canW, canH);
		
	// get the frequency data 
	//var freqData = this.getByteFrequencyData();
	var freqData = this.getTransformedFreqData(50,0,256);
	
	var freqCnt = freqData.length;
	
	var binW = canW/freqCnt;
	
	this.canvasCtx.fillStyle = "black";
	
	for (var i=0; i < freqCnt; i++) {
		// Draw the histogram bins
		this.canvasCtx.fillRect(i*binW, canH - freqData[i]*canH/256, binW, canH);
	}
}

