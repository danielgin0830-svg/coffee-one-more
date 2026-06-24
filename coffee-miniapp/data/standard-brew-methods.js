module.exports = [
  {
    "_id": "san_duan_shi",
    "method_name": "三段式冲煮法",
    "short_name": "三段式",
    "aliases": [
      "三刀流",
      "三段注水",
      "分段萃取法"
    ],
    "difficulty": "入门到中级",
    "category": "分段注水",
    "display_summary": "最通用的基础手冲框架，通过三次主注水控制层次、浓度和稳定性。",
    "core_logic": "闷蒸之后，把主萃取拆成 3 次注水，通过分段控制萃取节奏、浓度和层次。第一段主要建立香气和酸甜，第二段负责主体浓度和甜感，第三段补足尾段、醇厚度和完整度。",
    "background": "三段式没有单一发明者，更像是手冲教学中自然形成的标准化方法。它适合教学，因为动作清晰、容错率较高，也方便新手理解不同阶段注水对风味的影响。在门店出品中，三段式也容易形成 SOP。",
    "suitable_beans": {
      "roast": [
        "中浅烘",
        "浅中烘",
        "中烘"
      ],
      "flavor": [
        "花香",
        "果酸",
        "坚果",
        "焦糖",
        "茶感",
        "均衡型"
      ],
      "best_for": [
        "日常练习",
        "门店标准化",
        "大多数精品豆"
      ],
      "not_suitable": [
        "极浅烘高密度豆如果研磨偏粗，容易萃取不足",
        "深烘豆如果第三段水流太猛，容易苦涩"
      ]
    },
    "default_params": {
      "dose_g": 15,
      "water_g": 225,
      "ratio": "1:15",
      "temperature_c": {
        "light_roast": "92-94",
        "medium_roast": "88-92",
        "dark_roast": "84-88"
      },
      "grind_size": "中细到中等，接近细砂糖",
      "target_time": "2:15-3:00",
      "brewer": [
        "V60",
        "Origami",
        "蛋糕杯",
        "普通锥形滤杯"
      ],
      "pouring_style": "中小水流，中心向外绕圈，再回到中心",
      "notes": "适合作为基础参数，实际需根据豆子密度、烘焙度、滤杯流速和磨豆机细粉情况微调。"
    },
    "steps": [
      {
        "step": 1,
        "title": "预热滤杯和滤纸",
        "time": null,
        "water_to_g": null,
        "description": "用热水冲洗滤纸，预热滤杯和分享壶，然后倒掉热水。"
      },
      {
        "step": 2,
        "title": "倒粉整平",
        "time": null,
        "water_to_g": null,
        "description": "加入 15g 咖啡粉，轻轻拍平或摇平粉床。"
      },
      {
        "step": 3,
        "title": "闷蒸",
        "time": "0:00",
        "water_to_g": "30-35",
        "description": "注水覆盖所有咖啡粉，闷蒸 30-40 秒。"
      },
      {
        "step": 4,
        "title": "第一段注水",
        "time": "0:35",
        "water_to_g": "90",
        "description": "中小水流绕圈注水，主要让粉层重新抬升，建立香气和酸甜。"
      },
      {
        "step": 5,
        "title": "第二段注水",
        "time": "1:10",
        "water_to_g": "160",
        "description": "保持稳定绕圈，水位不要过高，避免冲刷滤纸边缘，建立主体浓度。"
      },
      {
        "step": 6,
        "title": "第三段注水",
        "time": "1:45",
        "water_to_g": "225",
        "description": "水流稍微放柔，补足尾段和完整度，避免后段过度扰动。"
      },
      {
        "step": 7,
        "title": "等待滴滤完成",
        "time": "2:15-3:00",
        "water_to_g": null,
        "description": "目标总时间 2:15-3:00。完成后粉床应相对平整，不应明显塌陷或泥化。"
      }
    ],
    "flavor_profile": [
      "层次清楚",
      "酸甜平衡",
      "浓度稳定",
      "适合大多数豆子"
    ],
    "adjustment_rules": [
      {
        "problem": "酸、薄、水感",
        "solution": "研磨调细；水温升高；延长总时间"
      },
      {
        "problem": "苦、涩、尾段脏",
        "solution": "研磨调粗；第三段水流减小；降低水温"
      },
      {
        "problem": "香气弱",
        "solution": "第一段注水更集中；闷蒸更充分；确认粉层是否完全湿润"
      },
      {
        "problem": "层次不明显",
        "solution": "拉开三段水量差距，例如 30/90/160/225"
      },
      {
        "problem": "口感太厚重",
        "solution": "粉水比改到 1:15.5 或 1:16；第三段减少扰动"
      }
    ],
    "common_mistakes": [
      "每段断水时间过长，导致粉层温度下降",
      "后段水流太大，把细粉冲到下层造成堵塞",
      "绕圈范围太大，直接冲刷滤纸边缘"
    ],
    "related_methods": [
      "one_pour",
      "four_six_method"
    ],
    "sort_order": 1,
    "status": "published",
    "version": "1.0.0"
  },
  {
    "_id": "one_pour",
    "method_name": "一刀流 / 连续主注水法",
    "short_name": "一刀流",
    "aliases": [
      "连续注水法",
      "One Pour",
      "细粉快冲",
      "不断水冲煮"
    ],
    "difficulty": "入门到中级",
    "category": "连续注水",
    "display_summary": "闷蒸后一次连续注水到底，动作少、变量少、效率高，适合稳定日常出品。",
    "core_logic": "闷蒸之后，不再多次断水，而是用一次连续、稳定的主注水完成萃取。重点是减少中途断水、保持粉床温度、降低人为变量，并通过稳定水流提升萃取均匀性。",
    "background": "一刀流在中文咖啡圈非常常见，尤其适合门店高峰期或家庭用户想减少复杂动作时使用。英文圈里类似的 One Pour 思路也常被用于 V60 教程中。需要注意，一刀流通常仍然包含闷蒸，不等同于完全无闷蒸的一投式。",
    "suitable_beans": {
      "roast": [
        "浅烘",
        "中浅烘",
        "中烘"
      ],
      "flavor": [
        "花香",
        "柑橘",
        "莓果",
        "茶感",
        "明亮型",
        "干净型"
      ],
      "best_for": [
        "快速出品",
        "日常标准杯",
        "低变量练习",
        "低旁通滤杯"
      ],
      "not_suitable": [
        "极深烘豆不适合高水温和强扰动",
        "细粉很多的豆子容易堵塞",
        "研磨不稳定时容易出现萃取不均"
      ]
    },
    "default_params": {
      "dose_g": 15,
      "water_g": 225,
      "ratio": "1:15",
      "temperature_c": {
        "light_roast": "92-95",
        "medium_roast": "88-92",
        "dark_roast": "84-88"
      },
      "grind_size": "中细，略细于三段式",
      "target_time": "1:50-2:40",
      "brewer": [
        "V60",
        "Origami",
        "低旁通锥形滤杯",
        "平底滤杯"
      ],
      "pouring_style": "闷蒸后连续绕圈注水，中途不断水",
      "notes": "核心不是快速乱倒，而是稳定、连续、可控地注完目标水量。"
    },
    "steps": [
      {
        "step": 1,
        "title": "预热器具",
        "time": null,
        "water_to_g": null,
        "description": "冲洗滤纸，预热滤杯和下壶。"
      },
      {
        "step": 2,
        "title": "倒粉整平",
        "time": null,
        "water_to_g": null,
        "description": "加入 15g 咖啡粉，整平粉床。"
      },
      {
        "step": 3,
        "title": "闷蒸",
        "time": "0:00",
        "water_to_g": "30-40",
        "description": "注水到 30-40g，等待 25-35 秒。可以轻轻摇晃滤杯，让粉层充分湿润。"
      },
      {
        "step": 4,
        "title": "连续主注水",
        "time": "0:30",
        "water_to_g": "225",
        "description": "用稳定中细水流，从中心向外绕圈，再回到中心。尽量不要冲到滤纸边缘，在 1:20-1:40 左右注到 225g。"
      },
      {
        "step": 5,
        "title": "等待滴滤完成",
        "time": "1:50-2:40",
        "water_to_g": null,
        "description": "目标总时间 1:50-2:40。如果超过 3:00，通常说明研磨过细、细粉过多或水流扰动太强。"
      }
    ],
    "flavor_profile": [
      "干净",
      "明亮",
      "效率高",
      "风味集中",
      "变量少"
    ],
    "adjustment_rules": [
      {
        "problem": "酸、尖锐、薄",
        "solution": "研磨调细；水温升高；注水速度放慢"
      },
      {
        "problem": "苦、涩、堵",
        "solution": "研磨调粗；水流减弱；减少绕圈范围"
      },
      {
        "problem": "风味不清楚",
        "solution": "注水更稳定；减少断水；避免冲滤纸边"
      },
      {
        "problem": "香气弱",
        "solution": "闷蒸水量增加到粉量 2.5 倍；确认闷蒸是否充分"
      },
      {
        "problem": "总时间太短",
        "solution": "研磨略细；注水速度减慢；适当降低滤杯旁通"
      }
    ],
    "common_mistakes": [
      "把一刀流理解成无闷蒸直接倒完",
      "注水过猛造成通道效应",
      "研磨过细又大水流扰动，导致堵塞和涩感"
    ],
    "related_methods": [
      "san_duan_shi",
      "hoffmann_v60"
    ],
    "sort_order": 2,
    "status": "published",
    "version": "1.0.0"
  },
  {
    "_id": "four_six_method",
    "method_name": "粕谷哲 4:6 法",
    "short_name": "4:6 法",
    "aliases": [
      "四六冲煮法",
      "Tetsu Kasuya 4:6 Method",
      "粕谷哲 4:6"
    ],
    "difficulty": "中级",
    "category": "比例模型",
    "display_summary": "把总水量拆成前 40% 和后 60%，前段调酸甜，后段调浓度，是最适合做计算器的手冲模型。",
    "core_logic": "把总水量分成前 40% 和后 60%。前 40% 主要调整酸甜平衡，后 60% 主要调整整体浓度、厚度和强度。前 40% 通常分成两段，后 60% 通常分成三段。",
    "background": "4:6 法由 2016 世界咖啡冲煮冠军粕谷哲推广。它的流行原因是把手冲从凭感觉注水转化为容易解释和计算的比例系统，非常适合做小程序里的参数生成器或风味调节模型。",
    "suitable_beans": {
      "roast": [
        "中浅烘",
        "中烘"
      ],
      "flavor": [
        "果酸",
        "蜂蜜",
        "焦糖",
        "热带水果",
        "发酵感",
        "复合香气"
      ],
      "best_for": [
        "风味教学",
        "酸甜调整",
        "浓度调整",
        "可视化计算器"
      ],
      "not_suitable": [
        "极浅烘高密度豆如果研磨太粗，容易萃取不足",
        "深烘豆如果水温过高，后段容易苦",
        "流速过慢的滤杯会让分段过多导致过萃"
      ]
    },
    "default_params": {
      "dose_g": 20,
      "water_g": 300,
      "ratio": "1:15",
      "temperature_c": {
        "general": "88-93"
      },
      "grind_size": "中粗，通常比普通 V60 更粗",
      "target_time": "3:00-3:45",
      "brewer": [
        "V60"
      ],
      "pouring_style": "5 段注水，每段之间自然滴滤",
      "notes": "标准模型为 20g 粉、300g 水。前 120g 调酸甜，后 180g 调浓度。"
    },
    "steps": [
      {
        "step": 1,
        "title": "第一段：酸甜调节 1",
        "time": "0:00",
        "water_to_g": "50",
        "description": "注水到 50g，等待到 0:45。标准甜感版本第一段较少，突出后续甜感。"
      },
      {
        "step": 2,
        "title": "第二段：酸甜调节 2",
        "time": "0:45",
        "water_to_g": "120",
        "description": "继续注水到 120g，等待到 1:30。前 40% 完成，决定主要酸甜结构。"
      },
      {
        "step": 3,
        "title": "第三段：浓度建立 1",
        "time": "1:30",
        "water_to_g": "180",
        "description": "注水到 180g，等待到 2:15。开始建立主体浓度。"
      },
      {
        "step": 4,
        "title": "第四段：浓度建立 2",
        "time": "2:15",
        "water_to_g": "240",
        "description": "注水到 240g，等待到 3:00。继续提升厚度和完整度。"
      },
      {
        "step": 5,
        "title": "第五段：浓度建立 3",
        "time": "3:00",
        "water_to_g": "300",
        "description": "注水到 300g，等待滴滤完成。目标总时间约 3:00-3:45。"
      }
    ],
    "ratio_model": {
      "front_40_percent": {
        "purpose": "调整酸甜",
        "standard_water_g": 120,
        "variants": [
          {
            "goal": "更明亮、更酸",
            "first_pour_g": 70,
            "second_pour_g": 50,
            "result": "酸质更突出"
          },
          {
            "goal": "更甜、更圆润",
            "first_pour_g": 50,
            "second_pour_g": 70,
            "result": "甜感更明显"
          },
          {
            "goal": "平衡",
            "first_pour_g": 60,
            "second_pour_g": 60,
            "result": "酸甜均衡"
          }
        ]
      },
      "back_60_percent": {
        "purpose": "调整浓度",
        "standard_water_g": 180,
        "variants": [
          {
            "goal": "浓度轻",
            "segments": 2,
            "water_each_g": 90,
            "result": "更轻盈"
          },
          {
            "goal": "标准浓度",
            "segments": 3,
            "water_each_g": 60,
            "result": "平衡"
          },
          {
            "goal": "浓度高",
            "segments": 4,
            "water_each_g": 45,
            "result": "更厚、更强"
          }
        ]
      }
    },
    "flavor_profile": [
      "结构清楚",
      "酸甜可控",
      "层次明显",
      "解释性强"
    ],
    "adjustment_rules": [
      {
        "problem": "太酸",
        "solution": "前 40% 改成 50g + 70g；水温略升"
      },
      {
        "problem": "不够甜",
        "solution": "第二段水量增加；研磨略细"
      },
      {
        "problem": "太淡",
        "solution": "后 60% 分成更多段；研磨略细"
      },
      {
        "problem": "太苦",
        "solution": "水温降低；后段减少分段；研磨调粗"
      },
      {
        "problem": "总时间太长",
        "solution": "研磨调粗；减少后段分段数"
      }
    ],
    "common_mistakes": [
      "研磨不够粗，导致多段注水后总时间过长",
      "只记住 5 段注水，却不理解前 40% 和后 60% 的调节逻辑",
      "用于极浅烘时水温过低，导致萃取不足"
    ],
    "related_methods": [
      "san_duan_shi"
    ],
    "sort_order": 3,
    "status": "published",
    "version": "1.0.0"
  },
  {
    "_id": "hoffmann_v60",
    "method_name": "James Hoffmann V60 法",
    "short_name": "Hoffmann V60",
    "aliases": [
      "Ultimate V60 Technique",
      "霍夫曼 V60",
      "James Hoffmann V60"
    ],
    "difficulty": "中级",
    "category": "高均匀萃取",
    "display_summary": "强调充分闷蒸、适度扰动和高均匀度，适合浅烘精品豆和高萃取表达。",
    "core_logic": "充分湿润粉层，使用较高水温和适度扰动，让萃取更均匀、更完整。它不单纯追求少搅动，而是通过合理旋转、轻微搅拌和粉床平整，减少干粉、边缘粉和不均匀萃取。",
    "background": "James Hoffmann 是英文咖啡圈影响力很高的咖啡作者、视频创作者和世界咖啡师冠军。他的 V60 方法在网络上非常流行，因为它解释了每个动作背后的目的，例如为什么要闷蒸、为什么要旋转、为什么后段要让粉床平整。",
    "suitable_beans": {
      "roast": [
        "浅烘",
        "中浅烘"
      ],
      "flavor": [
        "花香",
        "柑橘",
        "浆果",
        "茶感",
        "高海拔豆",
        "清晰型"
      ],
      "best_for": [
        "浅烘精品豆",
        "高均匀度萃取",
        "高甜感",
        "风味清晰表达"
      ],
      "not_suitable": [
        "深烘豆容易因高水温和扰动产生苦味",
        "细粉多的豆子容易堵塞",
        "流速过慢的滤杯容易导致总时间过长"
      ]
    },
    "default_params": {
      "dose_g": 30,
      "water_g": 500,
      "ratio": "1:16.7",
      "temperature_c": {
        "general": "95-100",
        "common_reference": "97"
      },
      "grind_size": "中细",
      "target_time": "3:00-3:45",
      "brewer": [
        "V60 02"
      ],
      "pouring_style": "闷蒸旋转 + 两段主注水 + 轻微搅拌/摇晃",
      "notes": "标准配方偏大杯量。可按比例缩小到 15g 粉、250g 水，但时间和注水节奏需要相应压缩。"
    },
    "steps": [
      {
        "step": 1,
        "title": "预热滤杯和滤纸",
        "time": null,
        "water_to_g": null,
        "description": "用热水充分冲洗滤纸，预热滤杯和分享壶。"
      },
      {
        "step": 2,
        "title": "倒粉并挖小坑",
        "time": null,
        "water_to_g": null,
        "description": "加入 30g 咖啡粉，轻轻整平粉床，在粉床中央挖一个小坑，帮助闷蒸水进入中心。"
      },
      {
        "step": 3,
        "title": "闷蒸",
        "time": "0:00",
        "water_to_g": "60",
        "description": "注水到 60g，尽量湿润所有咖啡粉。"
      },
      {
        "step": 4,
        "title": "旋转混合",
        "time": "0:00-0:45",
        "water_to_g": null,
        "description": "注完闷蒸水后，轻轻旋转滤杯，让粉水混合均匀。闷蒸到 0:45。"
      },
      {
        "step": 5,
        "title": "第一段主注水",
        "time": "0:45-1:15",
        "water_to_g": "300",
        "description": "用较积极的绕圈注水，在 1:15 左右注到 300g。这一步带来适度扰动，帮助均匀萃取。"
      },
      {
        "step": 6,
        "title": "第二段主注水",
        "time": "1:15-1:45",
        "water_to_g": "500",
        "description": "放柔水流，继续注到 500g，目标在 1:45 左右完成全部注水。"
      },
      {
        "step": 7,
        "title": "轻微搅拌",
        "time": "1:45",
        "water_to_g": null,
        "description": "用勺子轻轻顺时针、逆时针各搅一下，让挂在滤纸边缘的咖啡粉回到液面中。"
      },
      {
        "step": 8,
        "title": "最后旋转",
        "time": "液面下降后",
        "water_to_g": null,
        "description": "当液面下降一些后，轻轻旋转滤杯，让粉床变平。"
      },
      {
        "step": 9,
        "title": "等待滴滤完成",
        "time": "3:00-3:45",
        "water_to_g": null,
        "description": "目标总时间 3:00-3:45。完成后粉床应平整，杯中风味应完整、清晰。"
      }
    ],
    "flavor_profile": [
      "萃取完整",
      "甜感高",
      "风味清晰",
      "均匀度好"
    ],
    "adjustment_rules": [
      {
        "problem": "苦、涩、堵塞",
        "solution": "研磨调粗；减少旋转和搅拌；水温略降"
      },
      {
        "problem": "酸、薄、萃取不足",
        "solution": "研磨调细；水温升高；延长总时间"
      },
      {
        "problem": "粉床泥化",
        "solution": "降低扰动；不要大力旋转；换低细粉研磨"
      },
      {
        "problem": "风味浑浊",
        "solution": "注水更低、更稳；减少后段搅拌"
      },
      {
        "problem": "甜感不足",
        "solution": "闷蒸更充分；第一段注水更均匀"
      }
    ],
    "common_mistakes": [
      "旋转和搅拌过猛，导致细粉下沉堵塞",
      "深烘豆照搬高水温，导致苦涩",
      "粉量缩小后仍照搬大杯时间，导致过萃"
    ],
    "related_methods": [
      "one_pour",
      "san_duan_shi"
    ],
    "sort_order": 4,
    "status": "published",
    "version": "1.0.0"
  },
  {
    "_id": "osmotic_flow",
    "method_name": "点滴法 / Osmotic Flow",
    "short_name": "点滴法",
    "aliases": [
      "河野式",
      "日式慢冲",
      "渗透式冲煮",
      "Osmotic Flow",
      "Kono Method"
    ],
    "difficulty": "中高级",
    "category": "日式慢冲",
    "display_summary": "用极细水流或点滴方式低扰动萃取，突出甜感、圆润度和日式厚甜风味。",
    "core_logic": "用很小的水流或水滴，让水慢慢渗透粉层，减少大水流带来的扰动。它追求慢速湿润、低冲击力、稳定萃取、甜感和醇厚感。",
    "background": "点滴法属于典型日式手冲思路，不像现代 V60 教程那样追求高萃取效率，而是强调慢、稳、少扰动。河野式常用点滴预浸，让咖啡粉一点点吸水。松屋式则更极端，常见粗研磨、长时间闷蒸、萃取浓缩液后再加水稀释。",
    "suitable_beans": {
      "roast": [
        "中烘",
        "中深烘",
        "深烘",
        "日式烘焙"
      ],
      "flavor": [
        "焦糖",
        "坚果",
        "可可",
        "红糖",
        "熟水果",
        "厚甜感",
        "低酸感"
      ],
      "best_for": [
        "深烘甜感",
        "日式风味",
        "低酸柔和杯感",
        "慢冲练习"
      ],
      "not_suitable": [
        "极浅烘高密度豆容易萃取不足",
        "需要高温高萃取的豆子可能香气打不开",
        "新手手不稳时容易注水不均"
      ]
    },
    "default_params": {
      "dose_g": "18-20",
      "water_g": "240-300",
      "ratio": "1:13-1:15",
      "temperature_c": {
        "medium_roast": "88-92",
        "dark_roast": "82-88"
      },
      "grind_size": "中粗到粗",
      "target_time": "3:00-5:00",
      "brewer": [
        "河野滤杯",
        "V60",
        "法兰绒",
        "日式滤杯"
      ],
      "pouring_style": "极细水流 / 点滴预浸 / 中心小范围注水",
      "notes": "慢冲时间长，预热和水温稳定很重要。深烘豆通常需要降低水温并减少后段萃取。"
    },
    "steps": [
      {
        "step": 1,
        "title": "预热器具",
        "time": null,
        "water_to_g": null,
        "description": "充分预热滤杯、滤纸和下壶。慢冲时间长，预热很重要。"
      },
      {
        "step": 2,
        "title": "倒粉整平",
        "time": null,
        "water_to_g": null,
        "description": "加入 18-20g 咖啡粉，轻轻整平粉床，可以在中心做一个浅坑。"
      },
      {
        "step": 3,
        "title": "点滴预浸",
        "time": "0:00",
        "water_to_g": null,
        "description": "用极细水流或水滴注入中心，不要大面积绕圈，让水慢慢渗透粉层，直到咖啡液开始缓慢滴落。"
      },
      {
        "step": 4,
        "title": "扩大湿润范围",
        "time": "预浸后",
        "water_to_g": null,
        "description": "当中心粉层吸水膨胀后，慢慢扩大注水范围，仍然保持小水流、低扰动。"
      },
      {
        "step": 5,
        "title": "进入主萃取",
        "time": "粉层整体湿润后",
        "water_to_g": null,
        "description": "改为细水柱小范围绕圈。水位不要拉太高，避免大水流冲散粉层。"
      },
      {
        "step": 6,
        "title": "控制后段",
        "time": "接近目标水量时",
        "water_to_g": "240-300",
        "description": "萃取到目标水量后停止。如果采用松屋式思路，可以只萃取前半段浓缩液，再加热水稀释到目标浓度。"
      },
      {
        "step": 7,
        "title": "完成",
        "time": "3:00-5:00",
        "water_to_g": null,
        "description": "总时间通常比普通 V60 更长，约 3:00-5:00。完成后杯感应柔和、甜感明显、酸感较低。"
      }
    ],
    "flavor_profile": [
      "甜感高",
      "口感圆润",
      "酸感低",
      "尾韵柔和",
      "日式感强"
    ],
    "adjustment_rules": [
      {
        "problem": "太酸、太淡",
        "solution": "研磨调细；水温升高；延长预浸"
      },
      {
        "problem": "太苦、太闷",
        "solution": "水温降低；研磨调粗；缩短总时间"
      },
      {
        "problem": "风味打不开",
        "solution": "扩大主萃取绕圈范围；水温升高"
      },
      {
        "problem": "杂味明显",
        "solution": "减少后段萃取；降低扰动"
      },
      {
        "problem": "操作太慢",
        "solution": "从点滴改为极细连续水流"
      }
    ],
    "common_mistakes": [
      "点滴预浸过久，导致整体风味闷",
      "水温太低用于浅烘，导致香气打不开",
      "后段继续慢慢萃取太多，带出木质感和苦味"
    ],
    "related_methods": [
      "san_duan_shi"
    ],
    "sort_order": 5,
    "status": "published",
    "version": "1.0.0"
  }
];
