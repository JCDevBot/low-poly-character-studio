import unittest

from pathlib import Path
import sys

BLENDER_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BLENDER_DIR))

from generator.animation_pack import ANIMATION_PACK_ID, CLIPS, FPS, animation_metadata, validate_animation_pack
from generator.rig_contract import JOINT_PARENTS, RIG_ID


class AnimationPackContractTests(unittest.TestCase):
    def test_expected_clips_and_conventions(self):
        validate_animation_pack()
        self.assertEqual([clip.name for clip in CLIPS], ["a-pose", "idle", "walk", "wave"])
        self.assertEqual(FPS, 24)
        self.assertEqual([clip.name for clip in CLIPS if clip.loop], ["idle", "walk"])
        self.assertFalse(any(clip.root_motion for clip in CLIPS))

    def test_all_channels_target_humanoid_basic_v1(self):
        targets = {joint for clip in CLIPS for pose in clip.key_poses for joint in pose.rotations}
        self.assertTrue(targets)
        self.assertLessEqual(targets, set(JOINT_PARENTS))

    def test_loop_clips_repeat_first_pose(self):
        for clip in CLIPS:
            if clip.loop:
                self.assertEqual(clip.key_poses[0].rotations, clip.key_poses[-1].rotations)

    def test_metadata_is_stable_and_studio_readable(self):
        metadata = animation_metadata()
        self.assertEqual(metadata["packId"], ANIMATION_PACK_ID)
        self.assertEqual(metadata["rigId"], RIG_ID)
        self.assertEqual([clip["name"] for clip in metadata["clips"]], ["a-pose", "idle", "walk", "wave"])
        for clip in metadata["clips"]:
            self.assertIn("durationSeconds", clip)
            self.assertIn("loop", clip)
            self.assertIn("targetJoints", clip)


if __name__ == "__main__":
    unittest.main()
