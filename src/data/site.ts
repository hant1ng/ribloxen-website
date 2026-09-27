export const site = {
  name:'RIBLOXEN',
  company:'昆山日不落自动化设备有限公司',
  url:'https://ribloxen.com',
  description:'RIBLOXEN 日不落自动化，为自动化设备采购提供标准零部件选型、非标零件需求对接与多品类采购服务。',
  rfqOnline:false,
  contact:{
    name:'韩娟',
    phone:'18915758302',
    email:'han.juan@ribloxen.com',
    location:'中国 · 昆山'
  }
};

export const categories = [
{slug:'linear-motion',name:'直线运动',en:'LINEAR MOTION',desc:'围绕导向、支撑与直线传动，整理设备运动单元的采购需求。',items:['直线导轨与滑块','直线轴承','导向轴与支座','滚珠丝杆'],params:['行程与安装空间','负载与精度要求','安装尺寸','使用环境']},
{slug:'positioning',name:'定位与夹具',en:'LOCATING & FIXTURING',desc:'面向装配工装、治具与设备结构，确认定位、止动和夹紧需求。',items:['定位销','定位衬套','柱塞','调整螺丝'],params:['孔径与配合','材质与表面处理','定位精度','装配方式']},
{slug:'rotary-motion',name:'旋转运动',en:'ROTARY MOTION',desc:'围绕轴、轴承与旋转支撑，整理旋转机构的安装和载荷条件。',items:['旋转轴','滚动轴承','带座轴承','凸轮从动件'],params:['轴径','径向与轴向载荷','转速','安装结构']},
{slug:'transmission',name:'传动零部件',en:'POWER TRANSMISSION',desc:'从驱动连接到运动传递，按设备工况确认扭矩、速比和安装条件。',items:['联轴器','同步带与带轮','齿轮','链轮与链条'],params:['轴径与连接方式','转速与扭矩','传动比','中心距与安装空间']},
{slug:'conveying',name:'输送与滚轮',en:'CONVEYING & ROLLERS',desc:'用于工件搬送、导向与输送机构的滚轮、皮带和相关零件。',items:['输送滚轮','平皮带','圆皮带','导向件'],params:['输送物重量','速度','有效宽度','轴径与安装方式']},
{slug:'structure',name:'结构与框架',en:'STRUCTURE & FRAMING',desc:'配套设备框架、门板、防护和基础支撑结构。',items:['铝型材','型材连接件','支架','调节脚'],params:['型材系列','安装尺寸','承载要求','工作环境']},
{slug:'pneumatics',name:'气动元件',en:'PNEUMATICS',desc:'按动作、负载与气源条件，梳理气动执行、连接和真空需求。',items:['气缸','气动接头','气管','真空吸盘'],params:['缸径与行程','工作压力','接口规格','安装与动作方式']},
{slug:'fasteners-springs',name:'紧固与弹簧',en:'FASTENERS & SPRINGS',desc:'用于设备装配、预紧、复位和缓冲的常用机械标准件。',items:['螺栓与螺母','垫圈','压缩弹簧','拉伸弹簧'],params:['螺纹规格','长度','材料与强度','载荷与行程']},
{slug:'machine-accessories',name:'机器附件',en:'MACHINE ACCESSORIES',desc:'用于设备门体、移动、调节与人机操作的常用附件。',items:['把手','铰链','门锁','脚轮'],params:['安装孔距','载荷','材质','使用环境']},
{slug:'custom-machining',name:'非标加工件',en:'CUSTOM MACHINED PARTS',desc:'依据图纸、材质和工艺要求，逐项确认加工、检验与交付条件。',items:['板类与支架','轴类与套类','治具与工装零件'],params:['图纸与版本','材料牌号','公差与表面处理','数量与交付要求']}
];

export const nav = [
  ['产品中心','/products/'],
  ['非标零件','/custom-parts/'],
  ['解决方案','/solutions/'],
  ['技术资料','/knowledge/'],
  ['关于我们','/about/'],
  ['联系我们','/contact/']
];
