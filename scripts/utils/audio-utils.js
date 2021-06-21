// @ts-check

/**
 * Help create the audio player and find the approperiate source.
 *
 * @param {number} contentId Content ID
 * @param {Array} sources
 * @param {() => void} onPlay Callback
 * @param {() => void} onEnd Callback, run when the track ends
 * @param {() => void} onStop Callback, run when the player is paused
 * @param {boolean} loop
 * @return {HTMLAudioElement}
 */
export const createAudioPlayer = (
  contentId,
  sources,
  onPlay,
  onEnd,
  onStop,
  loop
) => {
  // Check if browser supports audio.
  let player = document.createElement("audio");
  if (player.canPlayType !== undefined) {
    // Add supported source files.
    sources
      .filter((source) => player.canPlayType(source.mime))
      .forEach((source) => {
        const sourceElement = document.createElement("source");
        sourceElement.src = H5P.getPath(source.path, contentId);
        sourceElement.type = source.mime;
        player.appendChild(sourceElement);
      });
  }

  const noSourcesAreSupported = player.children.length < 1;
  if (noSourcesAreSupported) {
    player = null;
  } else {
    player.controls = false;
    player.preload = "auto";
    player.loop = loop;
    player.addEventListener("play", onPlay);
    player.addEventListener("ended", onEnd);
    player.addEventListener("pause", onStop);
  }

  return player;
};

/**
 * Determine if the ID of the player belongs to a scene audio track.
 *
 * @param {string} id
 * @return {boolean}
 */
export const isInteractionAudio = (id) => {
  return id && id.substr(0, 12) === "interaction-";
};

/**
 * Determine if the ID of the player belongs to a video interaction.
 *
 * @param {string} id
 * @return {boolean}
 */
export const isVideoAudio = (id) => {
  return id && id.substr(0, 6) === "video-";
};

/**
 * Determine if the ID of the player belongs to a playlist.
 *
 * @param {string} id
 * @return {boolean}
 */
export const isPlaylistAudio = (id) => {
  return id && (id === "global" || id.substr(0, 9) === "playlist-");
};

/**
 * Determine if the ID of the player belongs to a scene audio track.
 *
 * @param {string} id
 * @return {boolean}
 */
export const isSceneAudio = (id) => {
  return id && (id === "global" || id.substr(0, 6) === "scene-");
};