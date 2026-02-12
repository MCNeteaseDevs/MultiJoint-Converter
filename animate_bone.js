/// <reference path="./blockbench-types/index.d.ts" />

let button;
let dialog;
let compSet;
let AnimationArray;
var selectedAnimationMap = {};
var now_animation = {};
var Need_BoneMap = {};
var base_translate_bone_map = {
    // '原骨骼名称': '新骨骼名称',
    root: "root",
    body: "",
    body_down: "waist",
    body_mid: "body",
    body_up: "body",
    head: "head",
    arms: "",
    Arms: "",
    left_arm_down: "leftArmDown",
    right_arm_down: "rightArmDown",
    left_leg_down: "leftLegDown",
    right_leg_down: "rightLegDown",
};
var translate_bone_map = {};
var acturlly_bone_origin = false;

Plugin.register('animate_bone', {
    title: 'MultiJoint Converter',
    author: 'MCNeteaseDevs',
    icon: 'fa-th',
    description: '将某个模型骨骼标准的动画一键转换为官方4D皮肤骨骼标准的动画',
    version: '1.0.0',
    variant: 'both',
    onload() {
        button = new Action('random_offset', {
            name: '转换动画骨骼组',
            description: 'Randomize the height of all selected elements',
            icon: 'bar_chart',
            click: function () {
                createFirstPanel();
            }
        });
        MenuBar.addAction(button, 'filter');
    },
    onunload() {
        button.delete();
    }
});

function GetAnimation(animationName) {
    const animation = Animation.all.find(anim => anim.name === animationName);
    if (!animation) {
        console.warn(`动画 "${animationName}" 未找到`);
        return null;
    }
    //console.log(`动画 "${animationName}" 已找到:`, animation);
    return animation;
}

function GetAnimationFrames(animation) {
    var superAnimation = {
        bone_frames: {},
        anim_time_update: animation.anim_time_update,
        blend_weight: animation.blend_weight,
        length: animation.length,
        loop: animation.loop,
        name: animation.name,
        override: animation.override,
        path: animation.path,
        snapping: animation.snapping,
        uuid: animation.uuid
    };
    var BoneArray = animation.animators;
    //console.log(`动画 "${animation.name}" 的骨骼数据:`, BoneArray);
    Object.values(BoneArray).forEach(bone => {
        var bone_position = bone.position;
        var bone_rotation = bone.rotation;
        var bone_scale = bone.scale;
        var bone_frame = {
            position: {},
            rotation: {},
            scale: {},
            base_bone: null
        }
        bone_position.forEach(frame => {
            bone_frame.position[frame.time] = [frame.data_points[0].x, frame.data_points[0].y, frame.data_points[0].z];
        });
        bone_rotation.forEach(frame => {
            bone_frame.rotation[frame.time] = [frame.data_points[0].x, frame.data_points[0].y, frame.data_points[0].z];
        });
        bone_scale.forEach(frame => {
            bone_frame.scale[frame.time] = [frame.data_points[0].x, frame.data_points[0].y, frame.data_points[0].z];
        });
        if (bone_position.length + bone_rotation.length + bone_scale.length != 0) {
            superAnimation.bone_frames[bone.name] = bone_frame;
        }
        bone_frame.base_bone = bone;
    });
    //console.log(`动画 "${animation.name}" 的完整骨骼帧数据:`, superAnimation);
    return superAnimation;
}

function dataPointToArray(data_points) {
    return [parseFloat(data_points[0].x), parseFloat(data_points[0].y), parseFloat(data_points[0].z)];
}

function arrayToDataPoint(array) {
    return [{ x: String(array[0]), y: String(array[1]), z: String(array[2]) }];
}

function GetGeoBone() {
    var importOptions = {
        errorbox: true,
        extensions: ['json'],
        multiple: false,
        resource_id: 'geometry',
        title: '选择参考几何体模型文件',
        type: 'text'
    };
    Filesystem.importFile(importOptions, onOpenGeo);
}

// 向量加法
const vectorAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// 向量减法
const vectorSubtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// 向量点乘（对应元素相乘）
const vectorMultiply = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

// 向量除法
const vectorDivide = (a, b) => [a[0] / b[0], a[1] / b[1], a[2] / b[2]];

const normalize = (vector) => {
    const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]);
    return length > 0 ? [
        vector[0] / length,
        vector[1] / length,
        vector[2] / length
    ] : [0, 0, 0];
};

const vectorToEuler = (vector) => [
    Math.atan2(vector[1], Math.sqrt(vector[0] * vector[0] + vector[2] * vector[2])) * (180 / Math.PI), // pitch
    Math.atan2(vector[2], vector[0]) * (180 / Math.PI) // yaw
];

/**
 * 角度转弧度
 * @param {number} degrees - 角度值
 * @returns {number} 弧度值
 */
function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * 弧度转角度
 * @param {number} radians - 弧度值
 * @returns {number} 角度值
 */
function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * 从欧拉角创建方向向量
     * @param {number} pitch - 俯仰角（弧度）
     * @param {number} yaw - 偏航角（弧度）
     * @returns {Vector3} 方向向量
     */
    static fromEuler(pitch, yaw) {
        pitch = degToRad(pitch);
        yaw = degToRad(yaw);
        return new Vector3(
            Math.cos(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.sin(yaw) * Math.cos(pitch)
        );
    }

    /**
     * 归一化向量
     * @returns {Vector3} 归一化后的向量
     */
    normalize() {
        const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (length > 0) {
            return new Vector3(this.x / length, this.y / length, this.z / length);
        }
        return new Vector3();
    }

    /**
     * 转换为单位向量
     */
    toUnitVector() {
        return this.normalize();
    }

    multiply(length) {
        /**
         * 将向量乘某个长度
         */
        this.x *= length;
        this.y *= length;
        this.z *= length;
        return this.toArray();
    }

    toArray() {
        /**
         * 输出为数组
         */
        return [this.x, this.y, this.z];
    }

    /**
     * 向量取模（求长度）
     * @returns {number} 向量的模（长度）
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * 向量取模（求长度）的别名方法
     * @returns {number} 向量的模（长度）
     */
    length() {
        return this.magnitude();
    }
}

function SuperGetFrame(bone_animators, value, time, channel, Undo, unknown) {
    var the_keyframe = undefined;
    bone_animators[channel].forEach(keyframe => {
        if (keyframe.time == time) {
            the_keyframe = keyframe;
            //console.log("从已有帧读取", bone_animators.name, time, the_keyframe.data_points[0]);
            return;
        }
    })
    if (!the_keyframe) {
        the_keyframe = bone_animators.createKeyframe(value, time, channel, Undo, unknown);
        //console.log("创建新的插值帧", bone_animators.name, time, the_keyframe.data_points[0]);
    }
    return the_keyframe;
}

function WorldXYZRotateToXY(base_vortex, x, y, z) {
    var cos_x = Math.cos(degToRad(x));
    var cos_y = Math.cos(degToRad(y));
    var cos_z = Math.cos(degToRad(z));
    var sin_x = Math.sin(degToRad(x));
    var sin_y = Math.sin(degToRad(y));
    var sin_z = Math.sin(degToRad(z));
    var vector = base_vortex;
    var nx = 0;
    var ny = 0;
    var nz = 0;
    nz = vector[2] * cos_x - vector[1] * sin_x;
    ny = vector[2] * sin_x + vector[1] * cos_x;
    vector[2] = nz;
    vector[1] = ny;
    nz = vector[2] * cos_y - vector[0] * sin_y;
    nx = vector[2] * sin_y + vector[0] * cos_y;
    vector[0] = nx;
    vector[2] = nz;
    nx = vector[0] * cos_z - vector[1] * sin_z;
    ny = vector[0] * sin_z + vector[1] * cos_z;
    vector[0] = nx;
    vector[1] = ny;
    return vector;
}

function TranslateAnimation(super_animation, NewAnimation) {
    var new_animators = NewAnimation.animators;
    var bone_frames = super_animation.bone_frames;
    var NowAnimators = {};
    Object.values(new_animators).forEach(boneObj => {
        NowAnimators[boneObj.name] = boneObj;
    });
    var connectBoneMap = {};
    var timeLineMap = {};
    Object.entries(translate_bone_map).forEach(([old_name, new_name]) => {
        if (connectBoneMap.hasOwnProperty(new_name)) {
            connectBoneMap[new_name].push(old_name);
        }
        else {
            connectBoneMap[new_name] = [old_name];
        }
    });
    var new_connect = {}
    Object.entries(connectBoneMap).forEach(([bone_name, old_names]) => {
        if (old_names.length <= 1 || bone_name === "") {
            delete connectBoneMap[bone_name];
        } else {
            old_names.forEach(old_name => {
                translate_bone_map[old_name] = "";
            });
            var key_name = old_names[0];
            translate_bone_map[key_name] = bone_name;
            new_connect[key_name] = old_names;
        }
    });
    connectBoneMap = new_connect;
    Object.entries(connectBoneMap).forEach(([bone_name, old_names]) => {
        var boneTimeLine = {
            position: [],
            rotation: [],
            scale: [],
        };
        old_names.forEach(old_name => {
            if (!bone_frames[old_name]) return;
            var old_b = bone_frames[old_name].base_bone;
            var old_pos = old_b.position;
            var old_rot = old_b.rotation;
            var old_scale = old_b.scale;
            old_pos.forEach(pos => { if (!boneTimeLine.position.includes(pos.time)) boneTimeLine.position.push(pos.time) });
            old_rot.forEach(rot => { if (!boneTimeLine.rotation.includes(rot.time)) boneTimeLine.rotation.push(rot.time) });
            old_scale.forEach(scale => { if (!boneTimeLine.scale.includes(scale.time)) boneTimeLine.scale.push(scale.time) });
        })
        timeLineMap[old_names[0]] = boneTimeLine;
        var old_bone_animator = NowAnimators[old_names[0]];
        SuperGetFrame(old_bone_animator, null, 0.0, "position", false, false);
        SuperGetFrame(old_bone_animator, null, 0.0, "rotation", false, false);
        SuperGetFrame(old_bone_animator, null, 0.0, "scale", false, false);
    });
    var now_bone_map = {};
    Group.all.forEach(bone => {
        now_bone_map[bone.name] = bone.origin;
    });
    //console.log('参考骨骼枢轴:', Need_BoneMap);
    //console.log('当前骨骼枢轴:', now_bone_map);
    //console.log('混流时间线表:', timeLineMap);
    Object.entries(NowAnimators).forEach(([new_bone_name, new_bone]) => {
        var bone_frame = bone_frames[new_bone_name];
        if (!bone_frame) return;
        var base_bone = bone_frame.base_bone;
        var base_position = base_bone.position;
        var base_rotation = base_bone.rotation;
        var base_scale = base_bone.scale;
        base_position.forEach(frame => {
            var keyframe_data = {
                bezier_left_time: frame.bezier_left_time,
                bezier_left_value: frame.bezier_left_value,
                bezier_linked: frame.bezier_linked,
                bezier_right_time: frame.bezier_right_time,
                bezier_right_value: frame.bezier_right_value,
                channel: frame.channel,
                color: frame.color,
                data_points: frame.data_points,
                interpolation: frame.interpolation,
                time: frame.time,
                uniform: frame.uniform
            }
            new_bone.addKeyframe(keyframe_data);
        });
        base_rotation.forEach(frame => {
            var keyframe_data = {
                bezier_left_time: frame.bezier_left_time,
                bezier_left_value: frame.bezier_left_value,
                bezier_linked: frame.bezier_linked,
                bezier_right_time: frame.bezier_right_time,
                bezier_right_value: frame.bezier_right_value,
                channel: frame.channel,
                color: frame.color,
                data_points: frame.data_points,
                interpolation: frame.interpolation,
                time: frame.time,
                uniform: frame.uniform
            }
            new_bone.addKeyframe(keyframe_data);
        });
        base_scale.forEach(frame => {
            var keyframe_data = {
                bezier_left_time: frame.bezier_left_time,
                bezier_left_value: frame.bezier_left_value,
                bezier_linked: frame.bezier_linked,
                bezier_right_time: frame.bezier_right_time,
                bezier_right_value: frame.bezier_right_value,
                channel: frame.channel,
                color: frame.color,
                data_points: frame.data_points,
                interpolation: frame.interpolation,
                time: frame.time,
                uniform: frame.uniform
            }
            new_bone.addKeyframe(keyframe_data);
        });
    });

    NewAnimation.save();

    var second_frame_position = {};
    var second_frame_rotation = {};
    var second_frame_scale = {};

    Object.entries(NowAnimators).forEach(([new_bone_name, new_bone]) => {
        var time_line = timeLineMap[new_bone_name];
        if (!time_line) return;
        var time_pos = time_line.position;
        var time_rot = time_line.rotation;
        var time_scale = time_line.scale;
        if (!connectBoneMap.hasOwnProperty(new_bone_name)) return;
        var second_frame_position_frame = second_frame_position[new_bone_name] ? second_frame_position[new_bone_name] : {};
        var second_frame_rotation_frame = second_frame_rotation[new_bone_name] ? second_frame_rotation[new_bone_name] : {};
        var second_frame_scale_frame = second_frame_scale[new_bone_name] ? second_frame_scale[new_bone_name] : {};
        time_pos.forEach(time => {
            var frame_position = [0, 0, 0];
            connectBoneMap[new_bone.name].forEach(other_name => {
                var other_frame = SuperGetFrame(NowAnimators[other_name], null, time, "position", false, false);
                frame_position = vectorAdd(frame_position, dataPointToArray(other_frame.data_points));
            });

            second_frame_position_frame[time] = frame_position;
        });
        time_rot.forEach(time => {
            var frame_rotation = [0, 0, 0];
            connectBoneMap[new_bone.name].forEach(other_name => {
                var other_frame = SuperGetFrame(NowAnimators[other_name], null, time, "rotation", false, false);
                frame_rotation = vectorAdd(frame_rotation, dataPointToArray(other_frame.data_points));
            });

            second_frame_rotation_frame[time] = frame_rotation;
        });
        time_scale.forEach(time => {
            var frame_scale = [1, 1, 1];
            connectBoneMap[new_bone.name].forEach(other_name => {
                var other_frame = SuperGetFrame(NowAnimators[other_name], null, time, "scale", false, false);
                frame_scale = vectorMultiply(frame_scale, dataPointToArray(other_frame.data_points));
            });

            second_frame_scale_frame[time] = frame_scale;
        });
        second_frame_position[new_bone_name] = second_frame_position_frame;
        second_frame_rotation[new_bone_name] = second_frame_rotation_frame;
        second_frame_scale[new_bone_name] = second_frame_scale_frame;
    });

    Object.entries(NowAnimators).forEach(([new_bone_name, new_bone]) => {
        var time_line = timeLineMap[new_bone_name];
        if (!time_line) return;
        var time_pos = time_line.position;
        var time_rot = time_line.rotation;
        var time_scale = time_line.scale;
        if (!connectBoneMap.hasOwnProperty(new_bone_name)) return;
        var second_frame_position_frame = second_frame_position[new_bone_name];
        var second_frame_rotation_frame = second_frame_rotation[new_bone_name];
        var second_frame_scale_frame = second_frame_scale[new_bone_name];
        time_pos.forEach(time => {
            var frame_position = second_frame_position_frame[time];

            var keyframe_data = SuperGetFrame(NowAnimators[new_bone_name], null, time, "position", false, false);

            keyframe_data.data_points[0].x = frame_position[0];
            keyframe_data.data_points[0].y = frame_position[1];
            keyframe_data.data_points[0].z = frame_position[2];

            new_bone.addKeyframe(keyframe_data);
        });
        time_rot.forEach(time => {
            var frame_rotation = second_frame_rotation_frame[time];

            var keyframe_data = SuperGetFrame(NowAnimators[new_bone_name], null, time, "rotation", false, false);

            keyframe_data.data_points[0].x = frame_rotation[0];
            keyframe_data.data_points[0].y = frame_rotation[1];
            keyframe_data.data_points[0].z = frame_rotation[2];

            new_bone.addKeyframe(keyframe_data);
        });
        time_scale.forEach(time => {
            var frame_scale = second_frame_scale_frame[time];

            var keyframe_data = SuperGetFrame(NowAnimators[new_bone_name], null, time, "scale", false, false);

            keyframe_data.data_points[0].x = frame_scale[0];
            keyframe_data.data_points[0].y = frame_scale[1];
            keyframe_data.data_points[0].z = frame_scale[2];

            new_bone.addKeyframe(keyframe_data);
        });
    });

    Object.entries(NowAnimators).forEach(([new_bone_name, new_bone]) => {
        var time_line = timeLineMap[new_bone_name];
        if (!time_line) return;
        var time_rot = time_line.rotation;
        if (!connectBoneMap.hasOwnProperty(new_bone_name)) return;
        var second_frame_rotation_frame = second_frame_rotation[new_bone_name];
        var translate_bone_name = translate_bone_map[new_bone_name];

        var now_bone_origin = now_bone_map[new_bone_name] ? now_bone_map[new_bone_name] : Need_BoneMap[translate_bone_name];
        var need_bone_origin = Need_BoneMap[translate_bone_name] ? Need_BoneMap[translate_bone_name] : now_bone_map[translate_bone_name];
        //console.log('super原始枢轴位置帧数据:', new_bone_name, now_bone_origin);
        //console.log('super修正枢轴位置帧数据:', translate_bone_name, need_bone_origin);
        var motion_origin = vectorSubtract(need_bone_origin, now_bone_origin);
        if (new Vector3(motion_origin[0] + motion_origin[1] + motion_origin[2]).length() <= 0) return;
        var new_position = {};
        time_rot.forEach(time => {
            var keyframe_data = SuperGetFrame(NowAnimators[new_bone_name], null, time, "position", false, false);
            var position = dataPointToArray(keyframe_data.data_points);
            var old_pos = position;
            var rotation = second_frame_rotation_frame[time];
            //console.log('原始位置帧数据:', time, position);
            console.log(motion_origin);
            var inverse_motion_origin = [-motion_origin[0], -motion_origin[1], -motion_origin[2]];

            var direcion = WorldXYZRotateToXY(normalize(motion_origin), -rotation[0], rotation[1], rotation[2]);
            direcion = new Vector3(direcion[0], direcion[1], direcion[2]);
            var dir_length = new Vector3(motion_origin[0], motion_origin[1], motion_origin[2]).length();
            var the_motion = direcion.multiply(dir_length);
            position = vectorAdd(position, inverse_motion_origin);
            position = vectorAdd(position, the_motion);
            //console.log('旋转角向量:', new_bone_name, time, rotation, direcion, dir_length, the_motion, motion_origin);

            console.log(`修正后pos`, translate_bone_name, vectorSubtract(position, old_pos));

            new_position[time] = position;
        });
        
        time_rot.forEach(time => {
            var keyframe_data = SuperGetFrame(NowAnimators[new_bone_name], null, time, "position", false, false);
            
            var position = new_position[time];

            keyframe_data.data_points[0].x = position[0];
            keyframe_data.data_points[0].y = position[1];
            keyframe_data.data_points[0].z = position[2];

            //new_bone.addKeyframe(keyframe_data);
        });
    });

    return new_animators;
}

function CreateAnimation(super_animation) {
    var NewAnimation = new Animation(
        {
            anim_time_update: super_animation.anim_time_update,
            blend_weight: super_animation.blend_weight,
            length: super_animation.length,
            loop: super_animation.loop,
            name: super_animation.name + '_4d',
            override: super_animation.override,
            path: `translate_animation.json`,
            snapping: super_animation.snapping
        }
    );
    Undo.initEdit({ animations: [NewAnimation] });
    NewAnimation.compileBedrockAnimation();
    NewAnimation.add(true);
    now_animation = NewAnimation;
    TranslateAnimation(super_animation, NewAnimation);
    NewAnimation.save();
    Undo.finishEdit('Create New Animation');
    return NewAnimation;
}

function onOpenAnimation(file) {
    var file_data = file[0];
    Object.entries(translate_bone_map).forEach(([old_name, new_name]) => {
        file_data.content = file_data.content.replaceAll(`"${old_name}":`, `"${new_name}":`);
    });
    var animation_data = JSON.parse(file_data.content);
    Object.values(animation_data.animations).forEach(bone_data => {
        var bones = bone_data.bones;
        delete bones[""];
    });
    file_data.content = JSON.stringify(animation_data, null, 2);

    var writeOptions = {
        content: file_data.content
    }
    Filesystem.writeFile(file_data.path, writeOptions, onWriteFile);
}

function onOpenGeo(file) {
    try {
        var file_data = file[0];
        var animation_data = JSON.parse(file_data.content);
        var bone_datas = animation_data["minecraft:geometry"][0].bones;
        var super_bone_data = {};
        Need_BoneMap = {};
        bone_datas.forEach(bone => {
            super_bone_data[bone.name] = bone.pivot;
        });
        Need_BoneMap = { ...super_bone_data };
        acturlly_bone_origin = true;
    }catch{}
}

function onWriteFile() {
    //console.log('文件写入成功:', now_animation.name);
}

function createFirstPanel() {
    const AnimationArray = Animation.all;
    translate_bone_map = { ...base_translate_bone_map };
    dialog = new Dialog({
        title: '选择要转换的动画',
        id: 'vertical_panel',
        width: 300,
        component: {
            data() {
                return {
                    animations: AnimationArray,
                    selectedMap: {}
                }
            },
            computed: {
                selectedCount() {
                    return Object.keys(this.selectedMap).length;
                }
            },
            methods: {
                handleClick(action, index) {
                    if (action === 'choose_all') {
                        this.selectedMap = {};
                        this.animations.forEach((anim, idx) => {
                            this.$set(this.selectedMap, anim.name, anim);
                        });
                    } else if (action === 'unchoose_all') {
                        this.selectedMap = {};
                    } else {
                        if (this.selectedMap[action]) {
                            this.$delete(this.selectedMap, action);
                        } else {
                            this.$set(this.selectedMap, action, this.animations[index]);
                        }
                    }
                    selectedAnimationMap = { ...this.selectedMap };
                    //console.log('当前选择的动画:', selectedAnimationMap);
                },

                getButtonStyle(animationName) {
                    const isSelected = animationName in this.selectedMap;
                    return {
                        padding: '14px',
                        background: isSelected ? '#73767cff' : '#2e323aff',
                        color: 'white',
                        border: isSelected ? '2px solid rgba(243, 245, 255, 1)ff' : 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                    };
                }
            },
            template: `
        <div style="padding: 10px;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button 
              v-for="(anim, index) in animations" 
              :key="anim.name"
              @click="handleClick(anim.name, index)"
              :style="getButtonStyle(anim.name)"
            >
              {{ anim.name }}
            </button>
            <div style="height: 1px; background: #ddd; margin: 14px 0;"></div>
            <div style="font-size: 12px; color: #ccc; text-align: center;">
              已选择 {{ selectedCount }} 个动画
            </div>
            <button @click="handleClick('choose_all')" style="padding: 14px; background: #2e323aff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: center;">
              选择全部
            </button>
            <button @click="handleClick('unchoose_all')" style="padding: 14px; background: #2e323aff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: center;">
              全不选择
            </button>
          </div>
        </div>
      `
        },
        onConfirm() {
            if (Object.keys(selectedAnimationMap).length != 0) {
                createSecondPanel();
            }
            else {
                var message_data = {
                    title: "提示",
                    message: "未选择动画"
                };
                Blockbench.showMessageBox(message_data);
            }
        }
    });

    dialog.show();
}

function createSecondPanel() {
    dialog = new Dialog({
        title: '调整骨骼转换关系',
        id: 'vertical_panel',
        width: 300,
        component: {
            data() {
                var base_bone_frames = Object.values(Animation.all[0].animators);
                return {
                    bone_frames: base_bone_frames,
                    inputMap: base_bone_frames.reduce((map, bone) => {
                        map[bone.name] = translate_bone_map[bone.name] ? translate_bone_map[bone.name] : bone.name; // 默认值优先使用预设映射表
                        return map;
                    }, {})
                };
            },
            methods: {
                // 你的交互逻辑保持不变
            },
            watch: {
                inputMap: {
                    handler(newMap) {
                        // 每当 inputMap 中任意字段变化时触发
                        translate_bone_map = { ...newMap }; // ✅ 更新全局变量
                        // console.log("骨骼映射更新：", translate_bone_map);
                    },
                    deep: true
                }
            },
            template: `
          <div style="padding: 10px;">
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
              <div v-for="bone in bone_frames" :key="bone.name" style="display: contents;">
                <div style="padding: 8px; font-weight: bold; color: #ccc;">
                  {{ bone.name }}
                </div>
                <input
                  type="text"
                  v-model="inputMap[bone.name]"
                  :placeholder="bone.name"
                  style="padding: 8px; border-radius: 4px; border: 1px solid #555; background: #2e323aff; color: white;"
                />
              </div>
            </div>
          </div>
        `
        },
        onConfirm() {
            //console.log('最终骨骼转换关系:', translate_bone_map);
            GetGeoBone();
            if (!acturlly_bone_origin) {
                var message_data = {
                    title: "错误",
                    message: "请选择有效模型文件"
                };
                Blockbench.showMessageBox(message_data);
                return;
            }
            var source_translate_bone_map = { ...translate_bone_map };
            Object.values(selectedAnimationMap).forEach(animation => {
                translate_bone_map = { ...source_translate_bone_map };
                var superAnimation = GetAnimationFrames(animation);
                CreateAnimation(superAnimation);
            });
            var readOptions = {
                errorbox: true,
                extensions: ['json'],
                multiple: 'text'
            }
            Filesystem.readFile([now_animation.path], readOptions, onOpenAnimation);
        }
    });

    dialog.show();
}