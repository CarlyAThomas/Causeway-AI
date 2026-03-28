import { VeoVideo } from "@/types";

export const VEO_GUIDES: Record<string, VeoVideo> = {
  "LOOSEN_LUGS": {
    id: "LOOSEN_LUGS",
    title: "Loosen Lug Nuts",
    description: "Use the lug wrench to loosen the nuts in a star pattern. Do not remove them yet.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", // Placeholder
    stepNumber: 1
  },
  "POSITION_JACK": {
    id: "POSITION_JACK",
    title: "Position the Jack",
    description: "Place the jack under the vehicle's frame near the tire you're changing.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", // Placeholder
    stepNumber: 2
  },
  "RAISE_VEHICLE": {
    id: "RAISE_VEHICLE",
    title: "Raise the Vehicle",
    description: "Carefully pump the jack to raise the vehicle until the flat tire is off the ground.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", // Placeholder
    stepNumber: 3
  },
  "REMOVE_TIRE": {
    id: "REMOVE_TIRE",
    title: "Remove the Flat Tire",
    description: "Fully unscrew the lug nuts and pull the flat tire toward you to remove it.",
    videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", // Placeholder
    stepNumber: 4
  }
};

export const getVeoGuide = (guideId: string): VeoVideo | undefined => {
  return VEO_GUIDES[guideId] || VEO_GUIDES["LOOSEN_LUGS"]; // Default to first step for demo
};
