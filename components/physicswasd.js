import AFRAME from 'aframe';

var KEYCODE_TO_CODE = {
  '38': 'ArrowUp',
  '37': 'ArrowLeft',
  '40': 'ArrowDown',
  '39': 'ArrowRight',
  '87': 'KeyW',
  '65': 'KeyA',
  '83': 'KeyS',
  '68': 'KeyD'
};
var THREE = AFRAME.THREE;
var registerComponent = AFRAME.registerComponent;
var utils = AFRAME.utils;

var bind = utils.bind;
var shouldCaptureKeyEvent = utils.shouldCaptureKeyEvent;

var CLAMP_VELOCITY = 0.00001;
var MAX_DELTA = 0.2;

/**
 * WASD component to control entities using WASD keys.
 */
export var Component = registerComponent('wasd-physics', {
  dependencies: ['static-body', 'dynamic-body'],
  schema: {
    acceleration: {default: 65},
    adAxis: {default: 'x', oneOf: ['x', 'y', 'z']},
    adEnabled: {default: true},
    adInverted: {default: false},
    easing: {default: 20},
    enabled: {default: true},
    fly: {default: false},
    wsAxis: {default: 'z', oneOf: ['x', 'y', 'z']},
    wsEnabled: {default: true},
    wsInverted: {default: false}
  },
  dependencies: ['quaternion', 'velocity'],

  init: function () {
    console.log('physics wasd init');
    // To keep track of the pressed keys.
    this.keys = {};

    this.velocity = new THREE.Vector3();

    // Bind methods and add event listeners.
    this.onBlur = bind(this.onBlur, this);
    this.onFocus = bind(this.onFocus, this);
    this.onKeyDown = bind(this.onKeyDown, this);
    this.onKeyUp = bind(this.onKeyUp, this);
    this.onVisibilityChange = bind(this.onVisibilityChange, this);
    this.attachVisibilityEventListeners();
  },

  tick: function (time, delta) {
    var data = this.data;
    var el = this.el;
    var movementVector;
    var position;
    var velocity = this.velocity;

    // Use seconds.
    delta = delta / 1000;

    // Get velocity.
    this.updateVelocity(delta);
    if (!velocity[data.adAxis] && !velocity[data.wsAxis]) { return; }

    // Get movement vector and translate position.
    movementVector = this.getMovementVector(delta);
    position = el.getAttribute('position');
    // el.setAttribute('position', {
    //   x: position.x + movementVector.x,
    //   y: position.y + movementVector.y,
    //   z: position.z + movementVector.z
    // });
    console.log('setting velocitiy ' + velocity.x);
    // el.setAttribute('velocity', {
    //   x: velocity.x,
    //   y: velocity.y,
    //   z: velocity.z
    // });
    el.components['dynamic-body'].body.velocity = el.components['dynamic-body'].body.velocity.vadd({
      x: velocity.x,
      y: velocity.y,
      z: velocity.z
    });
  },

  remove: function () {
    this.removeKeyEventListeners();
    this.removeVisibilityEventListeners();
  },

  play: function () {
    this.attachKeyEventListeners();
  },

  pause: function () {
    this.keys = {};
    this.removeKeyEventListeners();
  },

  updateVelocity: function (delta) {
    var acceleration;
    var adAxis;
    var adSign;
    var data = this.data;
    var keys = this.keys;
    var velocity = this.velocity;
    var wsAxis;
    var wsSign;

    adAxis = data.adAxis;
    wsAxis = data.wsAxis;

    // If FPS too low, reset velocity.
    if (delta > MAX_DELTA) {
      velocity[adAxis] = 0;
      velocity[wsAxis] = 0;
      return;
    }

    // Decay velocity.
    if (velocity[adAxis] !== 0) {
      velocity[adAxis] -= velocity[adAxis] * data.easing * delta;
    }
    if (velocity[wsAxis] !== 0) {
      velocity[wsAxis] -= velocity[wsAxis] * data.easing * delta;
    }

    // Clamp velocity easing.
    if (Math.abs(velocity[adAxis]) < CLAMP_VELOCITY) { velocity[adAxis] = 0; }
    if (Math.abs(velocity[wsAxis]) < CLAMP_VELOCITY) { velocity[wsAxis] = 0; }

    if (!data.enabled) { return; }

    // Update velocity using keys pressed.
    acceleration = data.acceleration;
    if (data.adEnabled) {
      adSign = data.adInverted ? -1 : 1;
      if (keys.KeyA || keys.ArrowLeft) { velocity[adAxis] -= adSign * acceleration * delta; }
      if (keys.KeyD || keys.ArrowRight) { velocity[adAxis] += adSign * acceleration * delta; }
    }
    if (data.wsEnabled) {
      wsSign = data.wsInverted ? -1 : 1;
      if (keys.KeyW || keys.ArrowUp) { velocity[wsAxis] -= wsSign * acceleration * delta; }
      if (keys.KeyS || keys.ArrowDown) { velocity[wsAxis] += wsSign * acceleration * delta; }
    }
  },

  getMovementVector: (function () {
    var directionVector = new THREE.Vector3(0, 0, 0);
    var rotationEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    return function (delta) {
      var rotation = this.el.getAttribute('rotation');
      var velocity = this.velocity;
      var xRotation;

      directionVector.copy(velocity);
      directionVector.multiplyScalar(delta);

      // Absolute.
      if (!rotation) { return directionVector; }

      xRotation = this.data.fly ? rotation.x : 0;

      // Transform direction relative to heading.
      rotationEuler.set(THREE.Math.degToRad(xRotation), THREE.Math.degToRad(rotation.y), 0);
      directionVector.applyEuler(rotationEuler);
      return directionVector;
    };
  })(),

  attachVisibilityEventListeners: function () {
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  },

  removeVisibilityEventListeners: function () {
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  },

  attachKeyEventListeners: function () {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  },

  removeKeyEventListeners: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  },

  onBlur: function () {
    this.pause();
  },

  onFocus: function () {
    this.play();
  },

  onVisibilityChange: function () {
    if (document.hidden) {
      this.onBlur();
    } else {
      this.onFocus();
    }
  },

  onKeyDown: function (event) {
    var code;
    if (!shouldCaptureKeyEvent(event)) { return; }
    code = event.code || KEYCODE_TO_CODE[event.keyCode];
    this.keys[code] = true;
  },

  onKeyUp: function (event) {
    var code;
    code = event.code || KEYCODE_TO_CODE[event.keyCode];
    this.keys[code] = false;
  }
});
