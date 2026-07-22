from dataclasses import dataclass


@dataclass(frozen=True)
class LittleGuyDNA:
    """Blender-ready proportions for the humanoid/chibi-v1 model type."""

    H: float = 1.40

    # Top-down landmarks. Dynamic properties below keep the visible neck short
    # when image-derived head proportions vary.
    head_height_ratio: float = 1 / 2.70
    eye_top_from_top_ratio: float = 0.21
    eye_center_from_top_ratio: float = 0.28
    neck_from_top_ratio: float = 0.44
    waist_from_top_ratio: float = 0.78
    knee_from_top_ratio: float = 0.94

    # Width/depth ratios.
    head_width_as_head_height: float = 1.02
    head_depth_ratio: float = 0.35
    shoulder_width_ratio: float = 0.72
    waist_width_ratio: float = 0.50
    hip_width_ratio: float = 0.72

    # Limb and foot ratios.
    arm_length_ratio: float = 0.27
    thigh_width_ratio: float = 0.28
    calf_width_ratio: float = 0.24
    foot_width_pair_ratio: float = 0.32
    foot_length_ratio: float = 0.30

    # Face ratios.
    eye_width_ratio: float = 0.075
    eye_height_ratio: float = 0.18
    eye_spacing_ratio: float = 0.38
    ear_position_from_top_ratio: float = 0.30
    ear_height_ratio: float = 0.18

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
        measured = self.H * (1 - self.neck_from_top_ratio)
        short_neck = self.head_bottom_z - self.head_height * 0.08
        return max(measured, short_neck)

    @property
    def waist_z(self) -> float:
        return self.H * (1 - self.waist_from_top_ratio)

    @property
    def knee_z(self) -> float:
        return self.H * (1 - self.knee_from_top_ratio)

    @property
    def shoulder_width(self) -> float:
        return self.head_height * self.shoulder_width_ratio

    @property
    def torso_width(self) -> float:
        return self.shoulder_width * 0.68

    @property
    def waist_width(self) -> float:
        return self.head_height * self.waist_width_ratio

    @property
    def torso_depth(self) -> float:
        return self.torso_width * 0.68

    @property
    def torso_height(self) -> float:
        return max(self.head_height * 0.62, self.neck_z - self.waist_z)

    @property
    def torso_center_z(self) -> float:
        return (self.neck_z + self.waist_z) / 2

    @property
    def hip_width(self) -> float:
        return max(
            self.waist_width * 1.08,
            self.head_height * self.hip_width_ratio * 0.72,
        )

    @property
    def arm_length(self) -> float:
        return self.H * self.arm_length_ratio

    @property
    def arm_radius(self) -> float:
        return self.head_height * 0.090

    @property
    def leg_length(self) -> float:
        return self.waist_z - 0.08

    @property
    def thigh_radius(self) -> float:
        return self.head_height * self.thigh_width_ratio * 0.34

    @property
    def calf_radius(self) -> float:
        return self.head_height * self.calf_width_ratio * 0.34

    @property
    def foot_width(self) -> float:
        return self.head_height * 0.30

    @property
    def foot_length(self) -> float:
        return self.head_height * self.foot_length_ratio

    @property
    def foot_height(self) -> float:
        return self.head_height * 0.10
