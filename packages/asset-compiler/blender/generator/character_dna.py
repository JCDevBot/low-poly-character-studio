from dataclasses import dataclass


@dataclass(frozen=True)
class LittleGuyDNA:
    """
    Blender-ready proportions derived from our Little Guy reference sheet.

    Important:
    - H is the total character height in Blender units.
    - Ratios come from the uploaded proportion sheet.
    - Gear is intentionally ignored for this base body pass.
    """

    H: float = 1.40

    # Top-down landmarks from the style sheet.
    head_height_ratio: float = 0.42
    eye_top_from_top_ratio: float = 0.21
    eye_center_from_top_ratio: float = 0.28
    neck_from_top_ratio: float = 0.44
    waist_from_top_ratio: float = 0.78
    knee_from_top_ratio: float = 0.94

    # Width/depth ratios.
    # The source sheet's head width reads like head width relative to head height.
    head_width_as_head_height: float = 0.98
    # The side-view depth ratio is treated as total-height-relative to keep the round side profile.
    head_depth_ratio: float = 0.47
    shoulder_width_ratio: float = 0.78
    waist_width_ratio: float = 0.72
    hip_width_ratio: float = 0.80

    # Limb and foot ratios from the sheet.
    arm_length_ratio: float = 0.27
    thigh_width_ratio: float = 0.28
    calf_width_ratio: float = 0.24
    foot_width_pair_ratio: float = 0.32
    foot_length_ratio: float = 0.36

    # Face ratios.
    eye_width_ratio: float = 0.06
    eye_height_ratio: float = 0.14
    eye_spacing_ratio: float = 0.24
    ear_position_from_top_ratio: float = 0.30
    ear_height_ratio: float = 0.16

    # Artistic tuning knobs.
    cheek_fullness: float = 1.08
    chin_softness: float = 0.78
    cranium_roundness: float = 1.06
    low_poly_segments: int = 12

    @property
    def top_z(self) -> float:
        return self.H

    @property
    def head_height(self) -> float:
        return self.H * self.head_height_ratio

    @property
    def head_bottom_z(self) -> float:
        return self.H - self.head_height

    @property
    def head_center_z(self) -> float:
        return self.head_bottom_z + self.head_height / 2

    @property
    def head_width(self) -> float:
        return self.head_height * self.head_width_as_head_height

    @property
    def head_depth(self) -> float:
        return self.H * self.head_depth_ratio

    @property
    def head_scale(self) -> tuple[float, float, float]:
        return (self.head_width / 2, self.head_depth / 2, self.head_height / 2)

    @property
    def eye_center_z(self) -> float:
        return self.H * (1 - self.eye_center_from_top_ratio)

    @property
    def eye_top_z(self) -> float:
        return self.H * (1 - self.eye_top_from_top_ratio)

    @property
    def eye_height(self) -> float:
        # Use the sheet value, but soften it for the base model so the eyes stay simple and cute.
        return self.head_height * self.eye_height_ratio

    @property
    def eye_width(self) -> float:
        return self.head_height * self.eye_width_ratio

    @property
    def eye_spacing(self) -> float:
        return self.head_height * self.eye_spacing_ratio

    @property
    def ear_center_z(self) -> float:
        return self.H * (1 - self.ear_position_from_top_ratio)

    @property
    def ear_height(self) -> float:
        return self.head_height * self.ear_height_ratio

    @property
    def neck_z(self) -> float:
        return self.H * (1 - self.neck_from_top_ratio)

    @property
    def waist_z(self) -> float:
        return self.H * (1 - self.waist_from_top_ratio)

    @property
    def knee_z(self) -> float:
        return self.H * (1 - self.knee_from_top_ratio)

    @property
    def shoulder_width(self) -> float:
        # Treat the sheet's shoulder width as relative to head height, not full H,
        # because the full-H interpretation is too wide for our current chibi base.
        return self.head_height * self.shoulder_width_ratio

    @property
    def torso_width(self) -> float:
        return self.shoulder_width * 0.68

    @property
    def torso_depth(self) -> float:
        return self.torso_width * 0.58

    @property
    def torso_height(self) -> float:
        return max(0.20, self.neck_z - self.waist_z)

    @property
    def torso_center_z(self) -> float:
        return (self.neck_z + self.waist_z) / 2

    @property
    def hip_width(self) -> float:
        return self.head_height * self.hip_width_ratio * 0.72

    @property
    def arm_length(self) -> float:
        return self.H * self.arm_length_ratio

    @property
    def arm_radius(self) -> float:
        return self.head_height * 0.075

    @property
    def leg_length(self) -> float:
        return self.waist_z - 0.08

    @property
    def thigh_radius(self) -> float:
        return self.head_height * self.thigh_width_ratio * 0.20

    @property
    def calf_radius(self) -> float:
        return self.head_height * self.calf_width_ratio * 0.20

    @property
    def foot_width(self) -> float:
        return (self.H * self.foot_width_pair_ratio) / 4

    @property
    def foot_length(self) -> float:
        return self.head_height * self.foot_length_ratio

    @property
    def foot_height(self) -> float:
        return self.head_height * 0.085
