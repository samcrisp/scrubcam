//declaring the global variables
var contextIn;
var contextModified;
var contextOut;
var contextOut2;

var width;
var height;

var filters = new Array();
var video;
var localMediaStream;
var timeout;
var filterManager;
var optionsBoxVisible = true;
var htracker;
var options;
var face;

var screenshots = {
	screenshots: new Array(),
	counter: 0,
	countInterval: null,
	updateScreenshots: function() {
		$('#screenshots').empty();
		for (var i=0; i<this.screenshots.length; i++) {
			var image = '<a href="' + this.screenshots[i] + '" download="screenshot' + i + '.png"><img src="' + this.screenshots[i] + '" style="width:133;height:100px"></a>';
			$("#screenshots").append(image);
		}
		if (this.screenshots.length > 0)
			$('#clearScreenshots').show();
		else $('#clearScreenshots').hide();
	},
	countUp:function(){
		if (screenshots.counter == 0) {
			clearInterval(screenshots.countInterval);
			$("#screenshotCounter").empty();
		}
		else {
			$("#screenshotCounter").append(screenshots.counter + '...');
			screenshots.counter--;
		}
	},
	takeScreenshotWithCountdown: function(length) {
		this.counter = length;
		$("#screenshotCounter").empty();
		this.countInterval = setInterval(this.countUp, 1000);
		this.countUp();
		$('#screenshotButton').prop('disabled',true);
		setTimeout(this.takeScreenshot, length * 1000);
	},
	takeScreenshot: function() {
		var canvasOut = document.getElementById("canvasOut");
		var img = canvasOut.toDataURL("image/png");
		screenshots.screenshots.push(img);

		//window.open(img, "_blank");

		screenshots.updateScreenshots();

		$('#screenshotButton').prop('disabled',false);
	},
	clearScreenshots: function() {
		this.screenshots = [];
		this.updateScreenshots();
	}
}

var sequencer = {
	sequence:[
		{time:1, element:1, turn:true},
		{time:1, element:2, turn:true},
		{time:5, element:1, turn:false},
		{time:3, element:1, key:'speed', value:0.0025},
		//{time:3, element:1, key:'speed', from:1.5, to:0.0025, duration:1.5},
		{time:7, element:2, turn:false},
		{time:3, element:3, turn:true},
		{time:4, element:3, turn:false},
		{time:5, element:4, turn:true},
		{time:6, element:4, turn:false},
	],
	currentTime:0.0,
	currentIndex:0,
	total:10.0,
	playing:false,
	lastUpdate:0.0,
	update:function(){
		if (!this.playing) return;
		var now = Date.now();
		var dt = now - this.lastUpdate;
		this.lastUpdate = now;
		this.currentTime += dt / 1000;
		console.log(this.currentTime);

		// Move seeker
		$('#seeker').css('transform','translate(' + this.currentTime*112 + 'px)');

		// Check for end of timeline
		if (this.currentTime > this.total) {
			// Run all events that are scheduled for end of timeline then end
			if (this.sequence[this.currentIndex]) {
				this.doEvents(this.total);
			}
			this.play();
			$('#seeker').css('transform','translate(0px)');
			return;
		}
		// Check for end of sequenced events
		if (!this.sequence[this.currentIndex]) return;
		// Activate sequenced events that have not been activated since their time passed
		this.doEvents(this.currentTime);
	},
	play:function(){
		resetTransform();
		this.playing = !this.playing;
		this.lastUpdate = Date.now();
		this.currentTime = 0.0;
		this.currentIndex = 0;
		//this.change(); //TEMP
	},
	sort:function(a,b){
		return (a.time - b.time);
	},
	change:function(){
		this.sequence.sort(this.sort);
	},
	doEvents:function(time){
		while (this.sequence[this.currentIndex].time < time) {
			var ev = this.sequence[this.currentIndex];
			// Do the event
			if (typeof ev.turn == 'boolean') {
				sequencerToggleOption(ev.element, ev.turn);
			}
			else if (typeof ev.value == 'string') {
				sequencerChangeOption(ev.element, ev.key, ev.value);
			}
			else if (typeof ev.value == 'number') {
				sequencerChangeText(ev.element, ev.key, ev.value);
			}
			else if (typeof ev.value == 'boolean') {
				sequencerChangeCheckbox(ev.element, ev.key, ev.value);
			}

			console.log(ev);
			this.currentIndex++;
			if (!this.sequence[this.currentIndex]) break;
		}
	}
};

//an event that will make the main function run once the entire web page has loaded
//window.onload = main;
$(document).ready(main);
function main(){
	filterManager = new CssFilterManager();
	//gets the canvas and its context to work with
	var canvasIn = document.getElementById("canvasIn");
	contextIn = canvasIn.getContext('2d');
	width = canvasIn.width;
	height = canvasIn.height;

	var canvasModified = document.getElementById("canvasModified");
	contextModified = canvasModified.getContext('2d');

	var canvasOut = document.getElementById("canvasOut");
	contextOut = canvasOut.getContext('2d');

	var canvasOut2 = document.getElementById("canvasOut2");
	contextOut2 = canvasOut2.getContext('2d');

	options = new Array(new Rotation(), new Zoom(), new Face(), new Superimpose({activated:false}), new Text({activated:false}), new Filter({activated:false}));
	face = options[2];

	for (var i = 0; i<options.length; i++) {
		// Run pre-init function
		if(typeof options[i].preinit == 'function') {
		 	options[i].preinit();
		}
	}

	updateOptions();
	updateSequencer();

	// Button to toggle hide/show options
	$('#toggleOptions').click(function(event){
        event.preventDefault();
		$('#sidebar').animate({
			marginLeft: parseInt($('#sidebar').css('marginLeft'),10) == 0 ?
        	-$('#sidebar').outerWidth() : 0
		});
		$('#sequencer').slideToggle();
		optionsBoxVisible = !optionsBoxVisible;
		$('#toggleOptions').text(optionsBoxVisible ? 'Close' : 'Customise');
	});

	$('#sidebar').css('marginLeft',optionsBoxVisible ? 0 : -$('#sidebar').outerWidth());
	if (!optionsBoxVisible) $('#sequencer').hide();
	$('#toggleOptions').text(optionsBoxVisible ? 'Close' : 'Customise');

	// Handle adding/sorting of options with jQuery UI

	$('#optionsBox').sortable({
		items: "li:not(.sort-disabled)",
		placeholder: "ui-state-highlight",
		distance: 10,
		start:function (event, ui) {
			var start_pos = ui.item.index();
            ui.item.data('start_pos', start_pos);
		},
		update:function (event, ui) {
			var start_pos = ui.item.data('start_pos');
            var index = ui.item.index();
            // Rearrange options array
            options.splice(index, 0, options.splice(start_pos, 1)[0]);
            updateOptions();

        	// Update sequencer
			for (var i = 0; i < sequencer.sequence.length; i++) {
				if (sequencer.sequence[i].element == start_pos) sequencer.sequence[i].element = index;
				else if (sequencer.sequence[i].element == index) sequencer.sequence[i].element = start_pos;
			}
		},
		receive:function(event,ui) {
			switch(ui.item.get(0).id.replace('buttonNew','')) {
	      	  	case "Superimpose":
	      	  	options.push(new Superimpose());
	      	  	break;
	      	  	case "Text":
	      	  	options.push(new Text());
	      	  	break;
	      	  	case "Filter":
	      	  	options.push(new Filter());
	      	  	break;
      	  	}
      	  	// Update will still get called so no need to call updateOptions() or to ensure it's in the right place
		}
	});
	$('#optionsTop .newElement').draggable({
		connectToSortable: "#optionsBox",
		appendTo: "body",
      	helper: "clone",
      	cancel: false
	}).click(function(){
		switch($(this).get(0).id.replace('buttonNew','')) {
	      	  	case "Superimpose":
	      	  	options.push(new Superimpose());
	      	  	break;
	      	  	case "Text":
	      	  	options.push(new Text());
	      	  	break;
	      	  	case "Filter":
	      	  	options.push(new Filter());
	      	  	break;
      	  	}
      	  	updateOptions();
	}).disableSelection();
	$('#optionsBox').disableSelection();

	// Handle adding/sorting of sequencer with jQuery UI

	$('#sequencer li').droppable({
		accept: "li:not(.sort-disabled)",
		hoverClass: "seq-drop-hover",
		activate:function (event, ui) {
			//var seq_start_pos = ui.item.index();
            //ui.item.data('seq_start_pos', seq_start_pos);
		},
		drop:function(event,ui) {
			updateSequencer();
		}
	}).disableSelection();

	// Initialise webcam
	video = document.querySelector("#video");
	navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
	window.URL = window.URL || window.webkitURL;
	navigator.getUserMedia({video:true, audio:false}, function (stream){
		video.src = window.URL.createObjectURL(stream);
		localMediaStream = stream;
		timeout = setTimeout(analyse, 40);
	}, onCameraFail);

	// Run all init functions
	for (var i=0; i < options.length; i++) {
		if(typeof options[i].init == 'function') {
			options[i].init();
		}
	}

	$('#playButton').click(function(){
		sequencer.play();
	});

	$('#screenshotButton').click(function(){
		screenshots.takeScreenshotWithCountdown(3);
	});
	$('#screenshotButtonImmediate').click(function(){
		screenshots.takeScreenshot();
	});

	$('#clearScreenshots').click(function(){
		screenshots.clearScreenshots();
	});
	screenshots.updateScreenshots();
}

//function that is called every time we want to analyse a new image/frame
function analyse(){
	if (video.paused || video.ended) return;
	//video stuff
	requestAnimationFrame(analyse);
	contextIn.drawImage(video, 0, 0, width, height);
	var frame = contextIn.getImageData(0,0,width,height);
	contextModified.putImageData(frame, 0, 0);

	contextModified.setTransform(1, 0, 0, 1, 0, 0);
	contextModified.clearRect(0, 0, width, height); // clear frame
	contextOut2.clearRect(0, 0, width, height);

	// Begin translation/rotation/scale
	if (face.x != 0 && face.y != 0) {
		contextModified.translate(face.x, face.y);
	}
	else contextModified.translate(width/2, height/2);

	// Run all update functions which run early
	for (var u in options) {
		if(typeof options[u].update == 'function') {
			if (options[u].centerOnFace && options[u].activated) {
				options[u].update();
			}
		}
	}

	// End translation/rotation/scale
	if (face.x != 0 && face.y != 0) {
		contextModified.translate(-face.x, -face.y);
	}
	else contextModified.translate(-height/2, -width/2);
	contextModified.drawImage(video, 0, 0, width, height);

	// Run all update functions which run late
	for (var u in options) {
		if(typeof options[u].update == 'function') {
			if (!(options[u].centerOnFace) && options[u].activated) {
				options[u].update();
			}
		}
	}

	frame = contextModified.getImageData(0,0,width,height);
	contextOut.putImageData(frame, 0, 0);

	// Apply CSS filters
	filterManager.update();

	// Run sequencer
	sequencer.update();
}

function CssFilterManager() {
	var filters = {};
	this.set = function (key,value) {
		filters[key] = value;
	}
	this.remove = function (key) {
		delete filters[key];
	}
	this.update = function() {
		var params = "";
		for (var i in filters) {
			params += i + '(' + filters[i] + ') ';
		}
		$("#canvasOut").css("-webkit-filter", params);
	}
}

function faceTrackEvent(e){
	face.height = e.height;
	face.width = e.width;
	face.angle = e.angle;
	face.y = e.y;
	face.x = e.x;
}

function onCameraFail(e){
	console.log("Camera did not work: ", e);
}

function sequencerToggleOption(i,on) {
	if (on) {
		try {
			options[i].activated = options[i].element.checked = true;
		}
		catch (err) {
			console.log(err);
		}
	}
	else {
		try {
			options[i].activated = options[i].element.checked = false;
			options[i].value = options[i].default || 0;
			if(typeof options[i].onDeactivate == 'function') {
				options[i].onDeactivate();
			}
		}
		catch (err) {
			console.log(err);
		}
	}
}

function sequencerChangeOption(i, property, val) {
	$("#option" + i + property).val('val');
	options[i][property] = val;
	$('#option'+i+property+'value').text(val);
}

function sequencerChangeText(i, property, val) {
	newValue = $("#option" + i + property).val(val);
	options[i][property] = val;
}

function sequencerChangeCheckbox(i, property, val) {
	newValue = $("#option" + i + property).prop('checked',val);
	options[i][property] = val;
	$("#option"+i+"panel"+property).toggle();
}

function onToggleOption(i) {
	if (!(options[i].activated = options[i].element.checked)) {
		options[i].value = options[i].default || 0;
		if(typeof options[i].onDeactivate == 'function') {
			options[i].onDeactivate();
		}
	}
}

function onChangeOption(i, property) {
	var newValue = $("#option" + i + property).val();
	options[i][property] = parseFloat(newValue);
	$('#option'+i+property+'value').text(newValue);
}

function onChangeText(i, property) {
	var newValue = $("#option" + i + property).val();
	options[i][property] = newValue;
}

function onChangeCheckbox(i, property) {
	var newValue = $("#option" + i + property).prop('checked');
	options[i][property] = newValue;
	$("#option"+i+"panel"+property).slideToggle('fast');
}

function resetTransform() {
	contextIn.setTransform(1, 0, 0, 1, 0, 0);
	for (var i = 0; i < options.length; i++) {
		if (options[i].value) options[i].value = options[i].default || 0;
		if(typeof options[i].onDeactivate == 'function') {
			options[i].onDeactivate();
		}
		options[i].element.checked = options[i].activated = false;
	}
}

function onSelectionChange(i,current,box,onchange){
	var oldSelection = options[i][current];
	options[i][current] = options[i][box].selectedIndex;
	if (typeof options[i][onchange] == 'function') options[i][onchange](oldSelection);
}

function onFaceChange(){
	//face.current = face.faceSelect.selectedIndex;
}

function canvasClick(){
	if (video.paused || video.ended) {
		video.play();
		htracker.start();
		timeout = setTimeout(analyse, 40);
	}
	else {
		video.pause();
		htracker.stop();
		clearTimeout(timeout);
	}
}

function updateSequencer() {
	sequencer.change();
	$('#sequencer').empty();
	for (var i=0; i<=sequencer.total; i++) {
		var iLabel = (i==0||i==sequencer.total) ? (i==0 ? "Start" : "End") : i;
		var listItem = "<div class='sequenceSlot'>" + iLabel + "</div>";
		//$("#sequencer").append(listItem);
		$(listItem).appendTo("#sequencer").css('left',i*111);
	}
	//$('#sequencer').append('<div id="sequencer"></div>');
	var elementCount = {};
	for (var i=0; i<sequencer.sequence.length; i++) {
		if ((typeof sequencer.sequence[i].turn == 'boolean') && !sequencer.sequence[i].turn) continue;
		if (!elementCount[sequencer.sequence[i].element]) elementCount[sequencer.sequence[i].element] = 0;
		var itemWidth = 111;
		var top = 36 * (sequencer.sequence[i].element)-13;
		var duration = itemWidth - 11;
		var elementName = options[sequencer.sequence[i].element].label;
		var elementDescription = options[sequencer.sequence[i].element].description() || "";
		var listItem = "<div class='sequenceItem' id='seq_item" + sequencer.sequence[i].element +"_" + elementCount[sequencer.sequence[i].element] + "'><strong>" + elementName + "</strong> <i>" + elementDescription + "</i><br />";
		// sequencer.sequence[i].element +"_" + elementCount[sequencer.sequence[i].element]
		if (sequencer.sequence[i].key) {
			listItem += "modify " + sequencer.sequence[i].key;
		}
		else {
			//listItem += "turn " + (sequencer.sequence[i].turn ? "on" : "off");
			for (var j=i+1; j<sequencer.sequence.length; j++) {

				if (sequencer.sequence[i].element == sequencer.sequence[j].element && (typeof sequencer.sequence[j].turn == 'boolean') && !sequencer.sequence[j].turn) {
					duration = (j-i-(j==i+1?0:1))*itemWidth - 11;
					console.log(duration + ' ' + i);
					break;
				}
			}
		}
		listItem += "</div>";
		$("#sequencer").append(listItem).children().last().css({'width':duration,'left':sequencer.sequence[i].time*itemWidth,'top':top});
		elementCount[sequencer.sequence[i].element]++;
	}
	$("[id^='seq_item']").each(function(){
		$(this).data('left',$(this).css('left').replace('px',''))
			   .data('top',$(this).css('top').replace('px',''));
		});
	$("[id^='seq_item']").resizable({
		handles:'e',
		minSize:100,
		start:function(event,ui){
			console.log(ui.originalElement.data('left'));
		},
		stop:function(event,ui){
			//console.log(ui.element.css('position'));
			//ui.element.css('position','relative !important');
			//ui.element.css('position','');
			ui.element.css({'left':ui.element.data('left'), 'top':ui.element.data('top')});
			var elementID = ui.element.attr('id').replace('seq_item','').split('_');
			for (var i=0; i < sequencer.sequence.length; i++) {
				//if (sequencer.sequence[i].element == elementID[0])
			}
			//console.log(ui.originalPosition.left);
		},
	}).draggable({
		axis:'x',
		containment: '#sequencer',
		stop:function(event,ui){
			ui.helper.data('left', ui.offset.left - parseInt(ui.helper.data('left')));

			console.log(ui.helper.data('left'));
		}
	}).disableSelection();

	// Timeline seeker
	var line = $('<div>').appendTo('#sequencer').addClass('line').attr('id','seeker');
}

function updateOptions() {
	// Remember which options were open/closed to restore
	var isOptionOpen = new Array();
	$("#optionsBox").children().each(function () {
		if ($(this).hasClass('newElement')) isOptionOpen.push(false);
		else isOptionOpen.push($(this).children('div').is(":visible"));
	});


	$("#optionsBox").empty();
	for (var i = 0; i<options.length; i++) {
		var listItem = "";
		listItem += '<li id="optionItem' + i +'"';
		if (options[i].immovable) listItem += ' class="sort-disabled"';
		listItem += '><label><input type="checkbox" id="option'+ i +'"onchange="onToggleOption('+ i +')" /> <strong>' + options[i].label + '</strong></label>';
		if (!options[i].immovable) listItem += '<button class="removeButton"></button>';
		listItem += '<span class="ui-icon ui-icon-carat-1-s"></span><div><table>';
		// Begin with this option on if the Object is activated when instantiated

		if (options[i].options) {
			// For each object in options, create a new input defined by the attributes given
			// Must have a "name" attribute
			for (var j = 0; j < options[i].options.length; j++) {
				// Create subpanels which show and hide based on a checkbox
				if (options[i].options[j].panel) {
					if (options[i].options[j].panel == 'start') {
						listItem += '<tr><td colspan="3"><div id="option' + i + 'panel' + options[i].options[j].selector + '"><table>';
					}
					else if (options[i].options[j].panel == 'end') {
						listItem += '</td></tr></table></div>';
					}
					continue;
				}
				// Create dropdown for array
				if (options[i][options[i].options[j].name] instanceof Array) {
					var thisSelect = '<tr><td class="optionName">' + options[i].options[j].name + ':</td><td class="optionValue"><select ';
					thisSelect += 'id="option' + i + options[i].options[j].name + '" onchange="onSelectionChange('+i+',&quot;'+options[i].options[j].current+'&quot;, &quot;' + options[i].options[j].selectBox + '&quot;';
					if (options[i].options[j].onchange) thisSelect += ',&quot;' + options[i].options[j].onchange+'&quot;';
					thisSelect += ')">';
					for (var o = 0; o < options[i][options[i].options[j].name].length; o++) {
						var optionName = options[i][options[i].options[j].name][o].id.replace(options[i].options[j].remove,"");
						thisSelect += '<option value="'+ optionName +'"';
						if (o == options[i][options[i].options[j].current]) {
							thisSelect += ' selected';
						}
						thisSelect += '>' + optionName + '</option>';
					}
					thisSelect += '</select></td></tr>';
					listItem += thisSelect;
					continue;
				}

				// If not array, create input with attributes from options array
				var thisOption = '<tr><td class="optionName">' + options[i].options[j].name + ':</td><td class="optionValue"><input ';
				var functionName = "onChangeOption";
				switch (options[i].options[j].type) {
					case 'text':
					case 'color':
					functionName = "onChangeText"
					break;
					case 'checkbox':
					functionName = "onChangeCheckbox";
					break;
					default:
					functionName = "onChangeOption";
					break;
				}
				for (var attribute in options[i].options[j]) {
					if (attribute == 'name') continue;
					thisOption+= attribute + '="' + options[i].options[j][attribute] + '" ';

				}
				thisOption += 'id="option' + i + options[i].options[j].name + '" onchange="'+functionName+'('+i+',&quot;' + options[i].options[j].name + '&quot;)"'
				if (options[i].options[j].type == 'checkbox') {
					thisOption += options[i][options[i].options[j].name] ? "checked" : "";
				}
				else thisOption += 'value="' + options[i][options[i].options[j].name] + '"';
				thisOption += '/></td>';
				// Give it a caption that will autoupdate if it's a range input
				if (options[i].options[j].type == 'range') {
					thisOption += '<td><div id="option'+i+options[i].options[j].name+'value">'+options[i][options[i].options[j].name]+'</div></td></tr>';
				}
				listItem += thisOption;
			}
		}
		listItem += '</div></table></li>';
		$("#optionsBox").append(listItem);

		options[i].element = document.getElementById("option"+i);
		if (options[i].activated) $("#option"+i).attr('checked','checked');
		if (options[i].options) {
			for (var j = 0; j < options[i].options.length; j++) {
				if (options[i].options[j].panel && !options[i][options[i].options[j].selector]) {
					$('#option'+i+'panel'+options[i].options[j].selector).hide();
				}
				if (options[i][options[i].options[j].name] instanceof Array) {
					options[i][options[i].options[j].selectBox] = $("#option" + i + options[i].options[j].name).get(0);
				}
			}
		}

	}

	// Make collapsable
	$('#optionsBox li').click(function() {
		var $elem = $(this).children('div');
		$(this).children('span').toggleClass('ui-icon-carat-1-s ui-icon-carat-1-n');
      	$elem.slideToggle('fast');
	    return false;
	}).each(function(){
		if (isOptionOpen.shift()) {
			$(this).children('div').show();
			$(this).children('span').toggleClass('ui-icon-carat-1-s ui-icon-carat-1-n');
		}
		else {
			$(this).children('div').hide();
		}
	}).children().not('span').click(function(e){
		e.stopPropagation();
	});

	// Make removable
	$( ".removeButton" ).button({
		icons: { primary: "ui-icon-circle-close"},
		text: false
	}).click(function(event){
		// Remove from options
		var opt = parseInt($(this).parent().get(0).id.replace('optionItem',''));
		options.splice(opt,1);
		// Update Sequencer
		// Update sequencer
		for (var i = 0; i < sequencer.sequence.length; i++) {
			if (sequencer.sequence[i].element == opt) {
				sequencer.sequence.splice(i,1);
				i--;
				if (sequencer.playing) {
					if (sequencer.currentIndex > i) sequencer.currentIndex--;
				}
			}
		}
		updateOptions();
		updateSequencer();
	});

	// Refresh scrollbars after 1 millisecond when DOM is refreshed
	$("#optionsBox").attr("overflow", "hidden");
	setTimeout(function(){
	   $("#optionsBox").attr("overflow", "auto");
	},1);

	/*
	$('#optionsBox li').click(function(event) {
		$(this).children('table').animate({
			marginTop: parseInt($('#sidebar').css('marginTop'),10) == 0 ?
        	-$('#sidebar').outerHeight() : 0
		});
	}); */
}

function play() {
	$("#audio1").get(0).play();
}

// Array.prototype.pick = function() {
//   return this[Math.floor(Math.random()*this.length)];
// }
