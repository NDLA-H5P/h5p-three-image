import React from "react";
import Main from "../../scripts/components/Main";
import { defaultAppContext } from "../../.storybook/config/contexts";
import { assignmentAppContext } from "../../.storybook/config/assignement-contexts";
import { H5PContext } from "../../scripts/context/H5PContext";
import Scene from "../../scripts/components/Scene/Scene";
import imageScene from "../static/alem-omerovic-2W3HhsqKHt8-unsplash.jpg";

const appContext = { ...defaultAppContext };
appContext.params.scenes[0] = {
  ...appContext.params.scenes[0],
  scenesrc: { path: imageScene },
  cameraStartPosition: "0,0",
  action: {metadata: {title: "test"}},
};

const assignmentContext = { ...assignmentAppContext};
assignmentAppContext.params.scenes[0] = {
  ...assignmentAppContext.params.scenes[0],
  scenesrc: { path: imageScene },
  cameraStartPosition: "0,0",
};

export default {
  title: "Scene",
  component: Scene,
  argTypes: {
    label: { type: "string" },
  },
};

const assignmentTemplate = (args) => (
  <H5PContext.Provider value={assignmentContext}>
    <Main {...args}>
      <Scene {...args}></Scene>
    </Main>
  </H5PContext.Provider>
);
const Template = (args) => (
  <H5PContext.Provider value={appContext}>
    <Main {...args}>
      <Scene {...args}></Scene>
    </Main>
  </H5PContext.Provider>
);

export const SceneStory = Template.bind({});
SceneStory.args = {
  label: "test",
  forceStartScreen: undefined,
  forceStartCamera: undefined,
  currentScene: 1,
  setCurrentSceneId: 1,
  imageSrc: {
    path: imageScene,
  },
  addThreeSixty: (tS) => undefined,
  onSetCameraPos: () => undefined,
};


export const SceneStoryWithAssignment = assignmentTemplate.bind({});
SceneStoryWithAssignment.args = {
  label: "Assignment",
  forceStartScreen: undefined,
  forceStartCamera: undefined,
  currentScene: 1,
  setCurrentSceneId: (id)=>1,
  imageSrc: {
    path: imageScene,
  },
  addThreeSixty: (tS) => undefined,
  onSetCameraPos: () => undefined,
};
