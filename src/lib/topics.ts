import { TopicCard } from "@/types/game";

export const TOPIC_POOL: TopicCard[] = [
  { cat: "동물", icon: "🐾", subjects: ["사자","기린","펭귄","문어","고슴도치","박쥐","코끼리","다람쥐","캥거루","거북이"] },
  { cat: "음식", icon: "🍕", subjects: ["피자","햄버거","김밥","라면","초밥","떡볶이","치킨","만두","짜장면","삼겹살"] },
  { cat: "탈것", icon: "🚗", subjects: ["자동차","자전거","비행기","헬리콥터","잠수함","기차","오토바이","요트","버스","열기구"] },
  { cat: "직업", icon: "💼", subjects: ["의사","요리사","경찰관","우주비행사","농부","소방관","화가","어부","발레리나","광부"] },
  { cat: "운동", icon: "⚽", subjects: ["축구","야구","농구","스키","양궁","펜싱","수영","테니스","복싱","볼링"] },
  { cat: "건물/장소", icon: "🏰", subjects: ["에펠탑","롤러코스터","성","등대","관람차","풍차","다리","텐트","이글루","자유의여신상"] },
  { cat: "캐릭터", icon: "👻", subjects: ["좀비","유령","외계인","인어","산타","마법사","해적","로봇","마녀","드라큘라"] },
  { cat: "한국적인 것", icon: "🇰🇷", subjects: ["한복","김치","장구","거북선","제기차기","탈춤","초가집","하회탈","돌하르방","장승"] },
  { cat: "도구", icon: "🔨", subjects: ["망치","드라이버","톱","펜치","삽","빗자루","가위","자물쇠","열쇠","낚싯대"] },
  { cat: "가구/생활", icon: "🛋️", subjects: ["소파","침대","피아노","시계","냉장고","세탁기","샹들리에","변기","청소기","화장대"] },
  { cat: "판타지/신화", icon: "🐉", subjects: ["용","유니콘","페가수스","그리핀","사이렌","거인","요정","미노타우로스","켈베로스","트롤"] },
  { cat: "애니메이션", icon: "🎬", subjects: ["올라프","짱구","피카츄","도라에몽","뽀로로","헬로키티","슈렉","스폰지밥","미키마우스","잔망 루피"] },
  { cat: "동화/우화", icon: "📖", subjects: ["잭과콩나무","피터팬","빨간모자","피노키오","인어공주","헨젤과그레텔","알라딘","라푼젤","곰돌이푸","미녀와야수"] },
];

export function getRandomCategory(): TopicCard {
  return TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
}

export function getRandomSubject(cat: string): string {
  const card = TOPIC_POOL.find((c) => c.cat === cat);
  if (!card) return "";
  return card.subjects[Math.floor(Math.random() * card.subjects.length)];
}

export function pickRandomTopic(): { cat: string; subject: string } {
  const card = getRandomCategory();
  const subject = card.subjects[Math.floor(Math.random() * card.subjects.length)];
  return { cat: card.cat, subject };
}
