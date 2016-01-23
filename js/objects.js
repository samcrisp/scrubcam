// Any objects added to the options array must have the following properties
// element: this points to the checkbox in the DOM which toggles it on and off
// activated: a bool which stores whether it is on or off
// options: an array of objects with properties that define how customisable it is
// 		name: refers to the property that is being modified, must be the same name
//		type: the type of input it is, any further properties are keys/values inside the input tag
// init: a function which will be called on startup (optional)
// update: a function that will be called every frame (optional)
// value: a value that will be reset to 0 (or default, see below) when reset button is pressed
// default: a value which will override what 'value' property will be set to when reset (optional)
// onDeactivate: a function that will be called when object is switched off
// centerOnFace: bool if true means this object's update function will be called between contextIn translations which center on the face (optional)
// and as many custom parameters as you like which can be modified in the inspector with the options object and accessed and modified in the init and update functions

// Options box can create selection boxes if you have the following parameters:
// {name:"[name of array]", current:"[current index value]", selectBox:"[selection box]", remove:"[string to remove from id]" (optional)}
// custom property initialized as 'new Array()' and populated in preinit function
// Array entries must be their own objects that have an id element, which will be what shows up on the box
// Can have multiple drop-down menus if each has their own current and selectBox parameters

var Rotation = function (options) {
	this.element = null;
	this.activated = false;
	this.speed = 10.0;
	this.magnitude = 20.0;
	this.value = 0;
	this.direction = true;
	this.label = "Rotate";
	this.options = [{name:"speed", type:"range", min:0, max:30, step:0.1},
			 {name:"magnitude", type:"range", min:0, max:360, step:1}];
	this.update = function() {
		if (this.magnitude == 360) {
			this.value = (this.value + this.speed) % 360;
		} else
		this.value = this.direction ? this.value + this.speed : this.value - this.speed;

		if (this.value >= this.magnitude) this.direction = false;
		else if (this.value <= -this.magnitude) this.direction = true;

		contextModified.rotate(this.value * Math.PI/180);
	}
	this.centerOnFace = true;
	this.immovable = true;
	this.description = function () {
		return "";
	}
};
var Zoom = function(options){
	this.element = null;
	this.activated = false;
	this.speed = 0.2;
	this.magnitude = 1.5;
	this.value = 1;
	this.default = 1;
	this.direction = true;
	this.label = "Zoom";
	this.options = [{name:"speed", type:"range", min:0, max:1, step:0.0025},
			 {name:"magnitude", type:"range", min:1, max:2, step:0.1}];
	this.update = function () {
		this.value = this.direction ? this.value + this.speed : this.value - this.speed;
		if (this.value >= this.magnitude) this.direction = false;
		else if (this.value <= 1) this.direction = true;

		contextModified.scale(this.value, this.value);
	}
	this.onDeactivate = function () {
		this.direction = true;
	}
	this.centerOnFace = true;
	this.immovable = true;
	this.description = function () {
		return "";
	}
}

var Face = function(options){
	this.prefab = options || {};
	this.element = null;
	this.activated = true;
	this.selectBox = null;
	this.img =  new Array();
	this.current = 0;
	this.imgAspect =  new Array();
	this.y =  0;
	this.x =  0;
	this.height =  0;
	this.width =  0;
	this.angle =  0;
	this.label = "Face";
	this.init = function () {
		//this.faceSelect = document.getElementById("faceSelect");

		htracker = new headtrackr.Tracker({ui:false,headposition:false,calcAngles:true});
	  	htracker.init(video, canvasIn);
	  	htracker.start();

		document.addEventListener('headtrackrStatus',
		  function (event) {
		  	$('#headtrackStatus').text('Head tracking: ' + event.status);
		    // if (event.status == "getUserMedia") {
		    //   //alert("getUserMedia is supported!");
		    // }
		  }
		);

		document.addEventListener('facetrackingEvent', faceTrackEvent);
	}
	this.update = function () {
		if (this.img[this.current]) {
			contextModified.save();
			contextModified.translate(this.x, this.y);
			contextModified.rotate(this.angle - (Math.PI/2));
			var faceWidth = this.height * this.imgAspect[this.current];
			contextModified.drawImage(this.img[this.current], - faceWidth/2, - this.height/2, faceWidth, this.height);
			contextModified.restore();
		}
	}
	this.options = [{name:"img", selectBox:"selectBox", current:"current", remove:"imgface"},
			 {name:"", type:"button", value:"recalibrate", onclick:"htracker.stop();htracker.start()"}];
	this.immovable = true;

	var img = this.img;
	var imgAspect = this.imgAspect;
	// pre-init
	$('[id^="imgface"]').each(function () {
			img.push(this);
			imgAspect.push(this.width / this.height);
		});
	this.description = function () {
		return "";
	}
};

var Superimpose = function(options) {
	this.prefab = options || {};
	this.element = null;
	this.activated = true;
	this.current = 0;
	this.selectBox = null;
	this.img = new Array();
	this.rotate = false;
	this.scale = 1;
	this.speed = 1;
	this.value = 0;
	this.magnitude = 20;
	this.direction = true;
	this.overlay = true;
	this.x = 0;
	this.y = 0;
	this.width = new Array();
	this.height = new Array();
	this.label = "Image";
	this.update = function () {
		var context = this.overlay ? contextOut2 : contextModified;
		var image = this.img[this.current];
		var width = this.width[this.current] * this.scale;
		var height = this.height[this.current] * this.scale;
		// Check for animated gif and update current frame
		if (image.frames) {
			if ((image.current += 1) >= image.frames.length) {
				image.current = 0;
			}
			image = image.frames[image.current];
		}
		context.save();
		context.translate(this.x+ width/ 2, this.y+height / 2);
		if (this.rotate) {
			if (this.magnitude == 360) {
				this.value = (this.value + this.speed) % 360;
			} else
			this.value = this.direction ? this.value + this.speed : this.value - this.speed;

			if (this.value >= this.magnitude) this.direction = false;
			else if (this.value <= -this.magnitude) this.direction = true;

			context.rotate(this.value * Math.PI/180);
		} else this.value = 0;
		context.translate(-width / 2, -height / 2);
		context.drawImage(image,0,0,width, height);
		context.restore();
	}
	this.options = [{name:"img", selectBox:"selectBox", current:"current"},
			 {name:"rotate", type:"checkbox"},
			 {panel:"start", selector:"rotate"},
			 {name:"speed", type:"range", min:0, max:40, step:1},
			 {name:"magnitude", type:"range", min:0, max:360, step:1},
			 {panel:"end"},
			 {name:"x", type:"range", min:-640, max:640, step:1},
			 {name:"y", type:"range", min:-480, max:480, step:1},
			 {name:"scale", type:"range", min:0.1, max:3.0, step:0.1},
			 {name:"overlay", type:"checkbox"},];

	// pre-init
	this.img.push(document.getElementById("mlg"));
	this.img.push(document.getElementById("leaf")); // TO DO: make this extendable
	this.img.push(document.getElementById("flare"));
	this.img.push({id:"snoop",frames:new Array(),current:0,width:77,height:201});
	var img = this.img;
	$('[id^="snoop"]').each(function () {
		this.width = 77;
		this.height = 201;
		img[3].frames.push(this);
	});
	for (var i=0; i<this.img.length; i++) {
		this.width.push(this.img[i].width);
		this.height.push(this.img[i].height);
	}
	for (var i in this.prefab) {
		this[i] = this.prefab[i];
	}
	this.description = function () {
		return this.img[this.current].id;
	}
};

var Text = function(options){
	this.prefab = options || {};
	this.element = null;
	this.activated = true;
	this.x = 320;
	this.y = 100;
	this.size = 70;
	this.rotate = false;
	this.speed = 1;
	this.value = 0;
	this.magnitude = 20;
	this.direction = true;
	this.overlay = true;
	this.thickness = 15;
	this.color = "#FFFFFF";
	this.outline = "#FF0000";
	this.text = "SMOKE W33D";
	this.label = "Text";
	this.update = function() {
		var context = this.overlay ? contextOut2 : contextModified;
		context.font = this.size + "px Arial";
		context.textAlign = 'center';
		context.fillStyle = this.color;

		var width = context.measureText(this.text);
		var height = 0;
		context.save();
		context.translate(this.x, this.y);
		if (this.rotate) {
			if (this.magnitude == 360) {
				this.value = (this.value + this.speed) % 360;
			} else
			this.value = this.direction ? this.value + this.speed : this.value - this.speed;

			if (this.value >= this.magnitude) this.direction = false;
			else if (this.value <= -this.magnitude) this.direction = true;

			context.rotate(this.value * Math.PI/180);
		} else this.value = 0;
		context.translate(-this.x, -this.y);
		if (this.thickness > 0) {
			context.strokeStyle = this.outline;
			context.lineWidth = this.thickness;
			context.strokeText(this.text, this.x, this.y);
		}
		context.fillText(this.text, this.x, this.y);
		context.restore();
		}
	this.options = [{name:"text", type:"text"},
			 {name:"rotate", type:"checkbox"},
			 {panel:"start", selector:"rotate"},
			 {name:"speed", type:"range", min:0, max:40, step:1},
			 {name:"magnitude", type:"range", min:0, max:360, step:1},
			 {panel:"end"},
			 {name:"x", type:"range", min:-640, max:640, step:1},
			 {name:"y", type:"range", min:-480, max:480, step:1},
			 {name:"size", type:"range", min:1, max:100, step:1},
			 {name:"color", type:"color"},
			 {name:"thickness", type:"range", min:0, max:20, step:0.1},
			 {name:"outline", type:"color"},
			 {name:"overlay", type:"checkbox"}];
	this.description = function () {
		return this.text;
	}

	for (var i in this.prefab) {
		this[i] = this.prefab[i];
	}
}

var Filter = function(options){
	this.prefab = options || {};
	this.element = null;
	this.activated = true;
	this.selectBox = null;
	this.current = 0;
	this.selectBoxStyle = null;
	this.currentStyle = 0;
	this.fadeStyle = [{id:"cycle"},{id:"once"},{id:"ping-pong"}];
	this.filter = [{name:"hue-rotate", id:"hue cycle", scale:3.6, suffix:"deg"},
			{name:"sepia", id:"sepia", scale:0.01},
			{name:"blur", id:"blur", scale:0.1, suffix:"px"},
			{name:"saturate", id:"saturate", scale:0.1},
			{name:"invert", id:"invert", scale:0.01},
			{name:"contrast", id:"contrast", scale:0.1},
			{name:"brightness", id:"brightness", scale:0.1},
			{name:"grayscale", id:"grayscale", scale:0.01}];
	this.magnitude = 100;
	this.direction = true;
	this.speed = 1;
	this.value = 30;
	this.label = "Filter";
	this.update = function(){
		var filter = this.filter[this.current];
		var speed = this.speed * filter.scale / 2;

		switch (this.currentStyle) {
			case 0:
				this.value = (this.value + speed) % (100 * filter.scale);
			break;
			case 1:
				if (this.value < 100 * filter.scale) this.value = (this.value + speed);
			break;
			case 2:
				this.value = this.direction ? this.value + speed : this.value - speed;
				if (this.value >= 100 * filter.scale) this.direction = false;
				else if (this.value <= 0) this.direction = true;
			break;
		}

		filterManager.set(this.filter[this.current].name, this.value + (this.filter[this.current].suffix || ""));
	}
	this.onDeactivate = function(){
		filterManager.remove(this.filter[this.current].name);
	}
	this.onChange = function(i){
		this.value = 0;
		filterManager.remove(this.filter[i].name);
	}
	this.options = [{name:"filter", selectBox:"selectBox", current:"current", onchange:"onChange"},
			 {name:"fadeStyle", selectBox:"selectBoxStyle", current:"currentStyle"},
			 {name:"speed", type:"range", min:0, max:100, step:1}];
	this.description = function () {
		return this.filter[this.current].id;
	}

	for (var i in this.prefab) {
		this[i] = this.prefab[i];
	}
}

var Audio = function(options){
	this.prefab = options || {};
	this.element = null;
	this.activated = false;
	this.label = "Audio";
}
