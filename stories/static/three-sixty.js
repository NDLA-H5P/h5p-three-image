H5P.NDLAThreeSixty = (function (EventDispatcher, THREE) {
  /**
   * Convert deg to rad
   * @return {number}
   */
  var toRad = function (value) {
    return value * (Math.PI / 180);
  };

  const maxPitch = Math.PI / 2;
  const pi2 = Math.PI * 2;

  /**
   * The 360 degree panorama viewer with support for virtual reality.
   *
   * @class H5P.NDLAThreeSixty
   * @extends H5P.EventDispatcher
   * @param {HTMLElement} sourceElement video or image source
   * @param {Object} options
   * @param {number} options.ratio Display ratio of the viewport
   * @param {Object} options.cameraStartPosition
   * @param {number} options.cameraStartPosition.yaw 0 = Center of image
   * @param {number} options.cameraStartPosition.pitch 0 = Center of image
   * @param {number} options.segments
   * @param {boolean} options.isPanorama
   */
  function NDLAThreeSixty(sourceElement, options) {
    /** @alias H5P.NDLAThreeSixty# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Settings
    const fieldOfView = options.isPanorama ? 53 : 75;
    const near = 0.1;
    const far = 1000;
    let ratio = options.ratio ? options.ratio : 16 / 9;

    // Main wrapper element
    self.element = document.createElement('div');
    self.element.classList.add('h5p-three-sixty');

    // TODO: ThreeSixty should not have to deal with this, this belongs in a
    // a separate collection/array class. (ThreeSixty should just add or remove
    // elements from the 3d world, not keep an indexed mapping for the
    // consumer/user of this library.)
    const threeElements = [];

    /**
     * Help set up renderers and add them to the main wrapper element.
     *
     * @private
     * @param {THREE.Object3D|THREE.WebGLRenderer} renderer
     */
    var add = function (renderer) {
      renderer.domElement.classList.add('h5p-three-sixty-scene');
      self.element.appendChild(renderer.domElement);
      return renderer;
    };

    /**
     * Set the label for the application element (camera controls).
     * Needed to be compatible with assitive tools.
     *
     * @param {string} label
     */
    self.setAriaLabel = function (label) {
      css2dRenderer.domElement.setAttribute('aria-label', label);
      css2dRenderer.domElement.setAttribute('role', 'document'); // TODO: Separate setting?

      css3dRenderer.domElement.setAttribute('aria-label', label);
      css3dRenderer.domElement.setAttribute('role', 'document'); // TODO: Separate setting?
    };

    /**
     * Get the container of all the added 3D elements.
     * Useful when rendering via React.
     *
     * @return {HTMLElement}
     */
    self.getRenderers = function () {
      return [css2dRenderer.domElement, css3dRenderer.domElement];
    };

    /**
     * Set focus to the scene.
     */
    self.focus = function () {
      css2dRenderer.domElement.focus();
    };

    /**
     * Change the tabindex attribute of the scene element
     *
     * @param {boolean} enable
     */
    self.setTabIndex = function (enable) {
      css2dRenderer.domElement.tabIndex = (enable ? '0' : '-1');
      css3dRenderer.domElement.tabIndex = (enable ? '0' : '-1');
    };

    /**
     * Set the current camera position.
     *
     * The default center/front part of an equirectangular image is usually
     * the center of image.
     *
     * @param {number} yaw Horizontal angle
     * @param {number} pitch Vertical angle
     */
    self.setCameraPosition = function (yaw, pitch) {
      if (preventDeviceOrientation) {
        return; // Prevent other codes from setting position while the user is dragging
      }
      camera.rotation.y = -yaw;
      camera.rotation.x = pitch;
      self.trigger('movestop', { // TODO: Figure out why this is here and what it does
        pitch: pitch,
        yaw: yaw,
      });
    };

    // Create scene, add camera and a WebGL renderer
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(fieldOfView, ratio, near, far);
    camera.rotation.order = 'YXZ';

    const camPos = options.cameraStartPosition || {};
    self.setCameraPosition(
      camPos.yaw !== undefined ? camPos.yaw : -(Math.PI * (2/3)),
      camPos.pitch !== undefined ? camPos.pitch : 0
    );
    const radius = 10;
    let segmentation = options.segments || 4;

    let sphere, renderLoopId = null;

    /**
     * Create the world sphere with its needed resources.
     * @private
     */
    const createSphere = function () {
      // Create a sphere surrounding the camera with the source texture
      const geometry = new THREE.SphereGeometry(radius, segmentation, segmentation);

      // Create material with texture from source element
      const material = new THREE.MeshBasicMaterial({
        map: new THREE.Texture(sourceElement, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBFormat)
      });
      material.map.needsUpdate = true;

      // Prepare sphere and add to scene
      sphere = new THREE.Mesh(geometry, material);
      geometry.scale(-1, 1, 1); // Flip to make front side face inwards
      scene.add(sphere);
    };

    const createCylinder = function () {
      // Create a sphere surrounding the camera with the source texture
      const geometry = new THREE.CylinderGeometry(radius, radius, radius, segmentation, segmentation, true);

      // Create material with texture from source element
      const material = new THREE.MeshBasicMaterial({
        map: new THREE.Texture(sourceElement, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter, THREE.RGBFormat)
      });
      material.map.needsUpdate = true;

      // Prepare sphere and add to scene
      sphere = new THREE.Mesh(geometry, material);
      geometry.scale(-1, 1, 1); // Flip to make front side face inwards
      scene.add(sphere);
    };

    /**
     * Remove sphere resources from memory.
     * @private
     */
    const disposeSphere = function () {
      scene.remove(sphere);
      sphere.geometry.dispose();
      sphere.material.dispose();
      sphere.material.map.dispose();
      sphere = null;
    };

    const renderer = add(new THREE.WebGLRenderer());

    // Create a scene for our "CSS world"
    const cssScene = new THREE.Scene();

    const css2dRenderer = add(new THREE.CSS2DRenderer);
    const css3dRenderer = add(new THREE.CSS3DRenderer);
    css2dRenderer.domElement.classList.add('h5p-three-sixty-2d');
    css3dRenderer.domElement.classList.add('h5p-three-sixty-3d'); 
    
    /**
     * Start rendering scene
     */
    self.startRendering = function () {
      if (renderLoopId === null) { // Prevents double rendering
        window.requestAnimationFrame(() => {
          // Since the 2D environment is rendered as "screen space overlay", it will always be "closest" to the camera.
          // By putting the CSS3DRenderer as the first child of CSS2DRenderer, we retain events such as
          // onClick, etc and pseudo-classes (hover etc) on all elements in scene
          css2dRenderer.domElement.insertBefore(css3dRenderer.domElement, css2dRenderer.domElement.firstChild);
        });
        
        render();
      }
    };

    /**
     * Stop rendering scene
     */
    self.stopRendering = function () {
      cancelAnimationFrame(renderLoopId);
      renderLoopId = null;
    };

    /**
     * Change the number of segments used to create the sphere.
     * Note: Rendering has to be stopped and started again for these changes
     * to take affect. (Due to memory management)
     * @param {number} numSegments
     */
    self.setSegmentNumber = function (numSegments) {
      segmentation = numSegments;
    };

    /**
     * Change the sourceElement of the world sphere.
     * Useful for changing scenes.
     * @param {DOMElement} element video or image source
     */
    self.setSourceElement = function (element) {
      sourceElement = element;
    };

    /**
     * Will re-create the world sphere. Useful after changing sourceElement
     * or segment number.
     *
     * Note that this will have to be called initally to create the sphere as
     * well to allow for full control.
     */
    self.update = function () {
      if (sphere) {
        disposeSphere();
      }
      createSphere();
      triggerFirstRenderEvent = true;
    }

    self.updateCylinder = function () {
      if (sphere) {
        disposeSphere();
      }
      createCylinder();
      triggerFirstRenderEvent = true;
    }

    let triggerFirstRenderEvent;

    /**
     * Triggers a redraw of texture fetched from the sourceElement.
     * This is useful in case the source has changed.
     */
    self.updateSource = function () {
      sphere.material.map.needsUpdate = true;
    };

    /**
     * Add element to "CSS 3d world"
     *
     * @param {HTMLElement} element
     * @param {Object} startPosition
     * @param {boolean} enableControls
     */
    self.add = function (element, startPosition, enableControls) {
      let threeElement;
      if(element.classList.contains("render-in-3d")){
        threeElement = new THREE.CSS3DObject(element);
        threeElement.is3d = true;
      } else {
        threeElement = new THREE.CSS2DObject(element);
      }
      threeElements.push(threeElement);

      // Reset HUD values
      element.style.left = "0";
      element.style.top = "0";

      if (enableControls) {
        var elementControls = new PositionControls(element);

        // Relay and supplement startMoving event
        elementControls.on('movestart', function (event) {
          // Set camera start position
          elementControls.startY = -threeElement.rotation.y;
          elementControls.startX = threeElement.rotation.x;

          preventDeviceOrientation = true;
          self.trigger(event);
        });

        // Update element position according to movement
        elementControls.on('move', function (event) {
          ThreeSixty.setElementPosition(threeElement, {
            yaw: elementControls.startY + event.alpha,
            pitch: elementControls.startX - event.beta
          });
        });

        // Relay and supplement stopMoving event
        elementControls.on('movestop', function (event) {
          event.data = {
            target: element,
            yaw: -threeElement.rotation.y,
            pitch: threeElement.rotation.x
          };
          preventDeviceOrientation = false;
          self.trigger(event);
        });

        // Move camera to element when tabbing
        element.addEventListener('focus', function (e) {
          if (!e.defaultPrevented) {
            self.setCameraPosition(-threeElement.rotation.y, threeElement.rotation.x);
          }
        }, false);
      }

      // Set initial position
      ThreeSixty.setElementPosition(threeElement, startPosition);

      cssScene.add(threeElement);
      return threeElement;
    };

    /**
     * Remove element from "CSS world"
     * @param {THREE.CSS3DObject} threeElement
     */
    self.remove = function (threeElement) {
      threeElements.splice(threeElements.indexOf(threeElement), 1);
      cssScene.remove(threeElement);
    };

    /**
     * Find the threeElement for the given element.
     * TODO: Move into a separate collection handling class
     *
     * @param {Element} element
     * @return {THREE.CSS3DObject}
     */
    self.find = (element) => 
      threeElements.find(threeElement => threeElement.element === element);

    /**
     * Find the index of the given element.
     * TODO: Move into a separate collection handling class
     *
     * @param {Element} element
     * @return {number}
     */
    self.indexOf = (element) =>
      threeElements.findIndex(threeElement => threeElement.element === element);

    /**
     * Get the position the camera is currently pointing at
     *
     * @return {Object}
     */
    self.getCurrentPosition = function () {
      return {
        yaw: -camera.rotation.y,
        pitch: camera.rotation.x
      };
    };

    /**
     * TODO
     */
    self.getCurrentFov = function () {
      return camera.getEffectiveFOV();
    };

    /**
     * TODO
     */
    self.getElement = function () {
      return self.element;
    };

    /**
     * Give new size
     */
    self.resize = function (newRatio) {
      if (!self.element.clientWidth) {
        return;
      }

      if (newRatio) {
        camera.aspect = newRatio;
        camera.updateProjectionMatrix();
      }
      else {
        newRatio = ratio; // Avoid replacing the original
      }

      // Resize main wrapping element
      self.element.style.height = (self.element.clientWidth / newRatio) + 'px';

      // Resize renderers
      renderer.setSize(self.element.clientWidth, self.element.clientHeight);
      css2dRenderer.setSize(self.element.clientWidth, self.element.clientHeight);
      css3dRenderer.setSize(self.element.clientWidth, self.element.clientHeight);
    };

    /**
     * @private
     */
    var render = function () {

      // Draw scenes
      renderer.render(scene, camera);
      css2dRenderer.render(cssScene, camera);
      css3dRenderer.render(cssScene, camera);

      // Prepare next render
      renderLoopId = requestAnimationFrame(render);

      if (triggerFirstRenderEvent) {
        triggerFirstRenderEvent = false;
        self.trigger('firstrender');
      }
    };

    // Add camera controls
    var cameraControls = new PositionControls(css2dRenderer.domElement, 400, true, true, options.isPanorama);

    // Workaround for touchevent not cancelable when CSS 'perspective' is set.
    renderer.domElement.addEventListener('touchmove', function (e) { });
    // This appears to be a bug in Chrome.

    // Camera starts moving handler
    cameraControls.on('movestart', function (event) {
      // Set camera start position
      cameraControls.startY = camera.rotation.y;
      cameraControls.startX = camera.rotation.x;

      preventDeviceOrientation = true;

      // Relay event
      self.trigger(event);
    });

    // Rotate camera as controls move
    cameraControls.on('move', function (event) {
      let yaw = cameraControls.startY + event.alpha;
      let pitch = cameraControls.startX + event.beta;

      // Set outer bounds for camera so it does not loop around.
      // It can max see max 90 degrees up and down
      const radsFromCameraCenter = toRad(fieldOfView) / 2;
      if (pitch + radsFromCameraCenter > maxPitch) {
        pitch = maxPitch - radsFromCameraCenter;
      }
      else if (pitch - radsFromCameraCenter < -maxPitch) {
        pitch = -maxPitch + radsFromCameraCenter;
      }

      // Keep yaw between 0 and 2PI
      yaw %= pi2;
      if (yaw < 0) { // Reset when passing 0
        yaw += pi2;
      }

      // Allow infinite yaw rotations
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    });

    // Relay camera movement stopped event
    cameraControls.on('movestop', function (event) {
      preventDeviceOrientation = false;
      event.data = {
        yaw: -camera.rotation.y,
        pitch: camera.rotation.x
      };
      self.trigger(event);
    });

    // Add approperiate styling
    css2dRenderer.domElement.classList.add('h5p-three-sixty-controls');
    css3dRenderer.domElement.classList.add('h5p-three-sixty-controls');

    var preventDeviceOrientation;
  }

  // Extends the event dispatcher
  ThreeSixty.prototype = Object.create(EventDispatcher.prototype);
  ThreeSixty.prototype.constructor = ThreeSixty;

  /**
   * Class for manipulating element position using different controls.
   *
   * @class
   * @param {THREE.Object3D} element
   * @param {number} [friction] Determines the speed of the movement
   * @param {boolean} [shouldInvert] Needed to invert controls for camera
   * @param {boolean} [isCamera]
   * @param {boolean} [isPanorama]
   */
  function PositionControls(element, friction, shouldInvert, isCamera, isPanorama) {
    /** @type PositionControls# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    // Set default parameters
    if (!friction) {
      friction = 800; // Higher = slower
    }
    let invert = shouldInvert ? 1 : -1;

    var alpha = 0; // From 0 to 2pi
    var beta = 0; // From -pi/2 to pi/2

    var controlActive; // Determine if a control is being used

    var startPosition; // Where the element is when it starts moving
    var prevPosition;

    let keyStillDown = null; // Used to determine if a movement key is being held down.

    /**
     * Generic initialization when movement starts.
     *
     * @private
     * @param {number} x Initial x coordinate
     * @param {number} y Initial y coordinate
     * @param {string} control Identifier
     * @param {Event} [e] Original event
     * @return {boolean} If it's safe to start moving
     */
    var start = function (x, y, control, e) {
      if (controlActive) {
        return false; // Another control is active
      }

      // Trigger an event when we start moving, and give other components
      // a chance to cancel
      const eventData = {
        element: element,
        isCamera: isCamera,
      };

      if (e) {
        eventData.target = e.target;
      }

      var movestartEvent = new H5P.Event('movestart', eventData);
      movestartEvent.defaultPrevented = false;

      self.trigger(movestartEvent);
      if (movestartEvent.defaultPrevented) {
        return false; // Another component doesn't want us to start moving
      }

      // Set initial position
      startPosition = {
        x: x,
        y: y
      };
      alpha = 0;
      beta = 0;

      controlActive = control;
      return true;
    };

    /**
     * Generic movement handler
     *
     * @private
     * @param {number} deltaX Current deltaX coordinate
     * @param {number} deltaY Current deltaY coordinate
     * @param {number} f Current friction
     */
    var move = function (deltaX, deltaY, f) {
      // Prepare move event
      var moveEvent = new H5P.Event('move');
      if(isPanorama) {
        deltaY = 0;
      }
      
      // Update position relative to cursor speed
      moveEvent.alphaDelta = deltaX / f;
      moveEvent.betaDelta = deltaY / f;
      alpha = (alpha + moveEvent.alphaDelta) % pi2; // Max 360
      beta = (beta + moveEvent.betaDelta) % Math.PI; // Max 180

      // Max 90 degrees up and down on pitch  TODO: test
      var ninety = Math.PI / 2;
      if (beta > ninety) {
        beta = ninety;
      }
      else if (beta < -ninety) {
        beta = -ninety;
      }

      moveEvent.alpha = alpha;
      moveEvent.beta = beta;

      // Trigger move event
      self.trigger(moveEvent);
    };

    /**
     * Generic deinitialization when movement stops.
     *
     * @private
     */
    var end = function () {
      element.classList.remove('dragging');
      controlActive = false;
      self.trigger('movestop');
    };

    /**
     * Handle mouse down
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseDown = function (event) {
      const isLeftClick = event.which === 1;
      if (!isLeftClick) {
        return;
      }

      if (!start(event.pageX, event.pageY, 'mouse', event)) {
        return; // Prevented by another component
      }

      // Prevent other elements from moving
      event.stopPropagation();

      // Register mouse move and up handlers
      window.addEventListener('mousemove', mouseMove, false);
      window.addEventListener('mouseup', mouseUp, false);

    };

    /**
     * Handle mouse move
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseMove = function (event) {
      let xDiff = event.movementX;
      let yDiff = event.movementY;
      if (event.movementX === undefined || event.movementY === undefined) {
        // Diff on old values
        if (!prevPosition) {
          prevPosition = {
            x: startPosition.x,
            y: startPosition.y,
          };
        }
        xDiff = event.pageX - prevPosition.x;
        yDiff = event.pageY - prevPosition.y;

        prevPosition = {
          x: event.pageX,
          y: event.pageY,
        };
      }
      if (xDiff !== 0 || yDiff !== 0) {
        move(xDiff, yDiff, friction);
      }
    };

    /**
     * Handle mouse up
     *
     * @private
     * @param {MouseEvent} event
     */
    var mouseUp = function (event) {
      prevPosition = null;
      window.removeEventListener('mousemove', mouseMove, false);
      window.removeEventListener('mouseup', mouseUp, false);
      end();
    };

    /**
     * Handle touch start
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchStart = function (event) {
      if (!start(event.changedTouches[0].pageX, event.changedTouches[0].pageY, 'touch')) {
        return;
      }

      element.addEventListener('touchmove', touchMove, false);
      element.addEventListener('touchend', touchEnd, false);
    };

    /**
     * Handle touch movement
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchMove = function (event) {
      if (!event.cancelable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      if (!prevPosition) {
        prevPosition = {
          x: startPosition.x,
          y: startPosition.y,
        };
      }
      const deltaX = event.changedTouches[0].pageX - prevPosition.x;
      const deltaY = event.changedTouches[0].pageY - prevPosition.y;
      prevPosition = {
        x: event.changedTouches[0].pageX,
        y: event.changedTouches[0].pageY,
      };
      move(deltaX, deltaY, friction * 0.75);
    };

    /**
     * Handle touch end
     *
     * @private
     * @param {TouchEvent} event
     */
    var touchEnd = function (event) {
      prevPosition = null;
      element.removeEventListener('touchmove', touchMove, false);
      element.removeEventListener('touchend', touchEnd, false);
      end();
    };

    /**
     * Handle touch start
     *
     * @private
     * @param {TouchEvent} event
     */
    var keyDown = function (event) {
      const isArrowKey = [37, 100, 38, 104, 39, 102, 40, 98].includes(event.which);
      if (!isArrowKey) {
        return;
      }

      if (keyStillDown === null) {
        // Try to start movement
        if (start(0, 0, 'keyboard')) {
          keyStillDown = event.which;
          element.addEventListener('keyup', keyUp, false);
        }
      }

      // Prevent the default behavior
      event.preventDefault();
      event.stopPropagation();

      if (keyStillDown !== event.which) {
        return; // Not the same key as we started with
      }

      const delta = {
        x: 0,
        y: 0
      };

      // Update movement in approperiate direction
      switch (event.which) {
        case 37:
        case 100:
          delta.x += invert;
          break;
        case 38:
        case 104:
          delta.y += invert;
          break;
        case 39:
        case 102:
          delta.x -= invert;
          break;
        case 40:
        case 98:
          delta.y -= invert;
          break;
      }
      move(delta.x, delta.y, friction * 0.025);
    };

    /**
     * Handle touch end
     *
     * @private
     * @param {TouchEvent} event
     */
    var keyUp = function (event) {
      keyStillDown = null;
      element.removeEventListener('keyup', keyUp, false);
      end();
    };

    /**
     * Manually handle focusing to avoid scrolling the elements out of place.
     *
     * @private
     * @param {TouchEvent} event
     */
    var focus = function (event) {
      event.preventDefault();
      event.target.focus({
        preventScroll: true
      });
    }

    /**
     * @return {number}
     */
    self.getAlpha = function () {
      return alpha;
    };

    /**
     * @return {number}
     */
    self.getBeta = function () {
      return beta;
    };

    /**
     * @param {string} [control] Check for specific control
     * @return {boolean}
     */
    self.isMoving = function (control) {
      return (control ? controlActive === control : !!controlActive);
    };

    // Register event listeners to position element
    element.addEventListener('mousedown', mouseDown, false);
    element.addEventListener('touchstart', touchStart, false);
    element.addEventListener('keydown', keyDown, false);
    element.tabIndex = '0';
    element.setAttribute('role', 'application');
    element.addEventListener('focus', focus, false);
  }

  /**
   * Set the element's position in the 3d world, always facing the camera.
   *
   * @param {THREE.CSS3DObject} threeElement
   * @param {Object} position
   * @param {number} position.yaw Radians from 0 to Math.PI*2 (0-360)
   * @param {number} position.pitch Radians from -Math.PI/2 to Math.PI/2 (-90-90)
   */
  ThreeSixty.setElementPosition = function (threeElement, position) {
    var radius = 800;

    threeElement.position.x = radius * Math.sin(position.yaw) * Math.cos(position.pitch);
    threeElement.position.y = radius * Math.sin(position.pitch);
    threeElement.position.z = -radius * Math.cos(position.yaw) * Math.cos(position.pitch);

    threeElement.rotation.order = 'YXZ';
    threeElement.rotation.y = -position.yaw;
    threeElement.rotation.x = +position.pitch;
  };

  return ThreeSixty;
})(H5P.EventDispatcher, H5P.ThreeJS);
