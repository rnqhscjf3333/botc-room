// 역할/시나리오 데이터. 한글 이름·능력 문구는 공식 번역과 다를 수 있으니 자유롭게 고쳐 쓰세요.
// (공식 아이콘은 저작권 때문에 포함하지 않고 팀 색상 배지로 대체)

export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon'

export interface Role {
  id: string
  ko: string
  en: string
  team: Team
  ability: string
}

export interface Script {
  id: string
  name: string
  roles: string[]
}

export const TEAM_LABEL: Record<Team, string> = {
  townsfolk: '마을 주민',
  outsider: '아웃사이더',
  minion: '하수인',
  demon: '악마',
}

export const isEvil = (t: Team) => t === 'minion' || t === 'demon'

type Row = [id: string, ko: string, en: string, team: Team, ability: string]
const T: Team = 'townsfolk'
const O: Team = 'outsider'
const M: Team = 'minion'
const D: Team = 'demon'

const rows: Row[] = [
  // ───── Trouble Brewing ─────
  ['washerwoman', '빨래하는 여인', 'Washerwoman', T, '첫날 밤, 마을 주민 두 명과 그중 한 명의 직업을 알게 됩니다.'],
  ['librarian', '사서', 'Librarian', T, '첫날 밤, 아웃사이더 두 명과 그중 한 명의 직업을 알게 됩니다. (또는 아웃사이더가 없음을 알게 됩니다.)'],
  ['investigator', '수사관', 'Investigator', T, '첫날 밤, 하수인 두 명과 그중 한 명의 직업을 알게 됩니다.'],
  ['chef', '요리사', 'Chef', T, '첫날 밤, 이웃한 악 플레이어 쌍이 몇 쌍인지 알게 됩니다.'],
  ['empath', '공감능력자', 'Empath', T, '매 밤, 살아있는 양쪽 이웃 중 악 플레이어가 몇 명인지 알게 됩니다.'],
  ['fortuneteller', '점쟁이', 'Fortune Teller', T, '매 밤, 두 명을 골라 그중 악마가 있는지 알게 됩니다. 선한 플레이어 한 명이 악마로 보입니다.'],
  ['undertaker', '장의사', 'Undertaker', T, '매 밤(첫날 제외), 오늘 처형당한 플레이어의 직업을 알게 됩니다.'],
  ['monk', '수도승', 'Monk', T, '매 밤(첫날 제외), 한 명을 골라 보호합니다. 그 사람은 악마에게 죽지 않습니다.'],
  ['ravenkeeper', '레이븐키퍼', 'Ravenkeeper', T, '밤에 죽으면, 한 명을 골라 그 사람의 직업을 알게 됩니다.'],
  ['virgin', '처녀', 'Virgin', T, '처음으로 지목당했을 때, 지목한 사람이 마을 주민이면 그 사람이 즉시 처형당합니다.'],
  ['slayer', '슬레이어', 'Slayer', T, '게임 중 한 번, 낮에 공개적으로 한 명을 골라 쏩니다. 그 사람이 악마라면 죽습니다.'],
  ['soldier', '병사', 'Soldier', T, '악마에게 죽지 않습니다.'],
  ['mayor', '시장', 'Mayor', T, '생존자가 3명뿐이고 처형이 없으면 선한 팀이 승리합니다. 밤에 죽을 때 다른 사람이 대신 죽을 수 있습니다.'],
  ['butler', '집사', 'Butler', O, '매 밤, 주인을 한 명 고릅니다. 내일은 주인이 투표할 때만 투표할 수 있습니다.'],
  ['drunk', '주정뱅이', 'Drunk', O, '자신이 주정뱅이인 줄 모릅니다. 마을 주민이라고 생각하지만 능력이 작동하지 않습니다.'],
  ['recluse', '은둔자', 'Recluse', O, '악 플레이어, 하수인 또는 악마로 인식될 수 있으며, 죽지 않아도 그렇게 보일 수 있습니다.'],
  ['saint', '성자', 'Saint', O, '처형당해 죽으면 선한 팀이 패배합니다.'],
  ['poisoner', '독살범', 'Poisoner', M, '매 밤, 한 명을 골라 독살합니다. 오늘 밤과 내일 낮 동안 그 사람의 능력이 오작동합니다.'],
  ['spy', '스파이', 'Spy', M, '매 밤, 그리모어를 볼 수 있습니다. 선한 플레이어로 인식될 수 있습니다.'],
  ['scarletwoman', '주홍 여인', 'Scarlet Woman', M, '생존자가 5명 이상일 때 악마가 죽으면 당신이 새 악마가 됩니다.'],
  ['baron', '남작', 'Baron', M, '아웃사이더가 2명 더 들어옵니다. (셋업 시 적용)'],
  ['imp', '임프', 'Imp', D, '매 밤(첫날 제외), 한 명을 골라 죽입니다. 자신을 고르면 자살하고 하수인 중 한 명이 임프가 됩니다.'],

  // ───── Bad Moon Rising ─────
  ['grandmother', '할머니', 'Grandmother', T, '첫날 밤, 선한 손주 한 명과 그의 직업을 알게 됩니다. 악마가 손주를 죽이면 당신도 죽습니다.'],
  ['sailor', '선원', 'Sailor', T, '매 밤, 살아있는 플레이어 한 명을 골라 그와 당신 중 한 명이 취합니다.'],
  ['chambermaid', '시녀', 'Chambermaid', T, '매 밤, 두 명을 골라 그들 중 몇 명이 능력 때문에 밤에 깨었는지 알게 됩니다.'],
  ['exorcist', '퇴마사', 'Exorcist', T, '매 밤(첫날 제외), 한 명을 골라 그 사람이 악마라면 오늘 밤 악마는 깨어나지 못합니다. 같은 사람을 연속으로 고를 수 없습니다.'],
  ['innkeeper', '여관 주인', 'Innkeeper', T, '매 밤(첫날 제외), 두 명을 골라 그들은 오늘 밤 죽지 않지만 그중 한 명은 취합니다.'],
  ['gambler', '도박꾼', 'Gambler', T, '매 밤(첫날 제외), 한 명의 직업을 추측합니다. 틀리면 죽습니다.'],
  ['gossip', '수다쟁이', 'Gossip', T, '매 낮, 공개적으로 진술을 할 수 있습니다. 그 진술이 참이면 오늘 밤 누군가 죽습니다.'],
  ['courtier', '신하', 'Courtier', T, '게임 중 한 번, 밤에 직업 하나를 골라 이야기꾼이 3일 밤 3일 낮 동안 그 직업의 플레이어를 취하게 만듭니다.'],
  ['professor', '교수', 'Professor', T, '게임 중 한 번, 밤에 죽은 마을 주민 한 명을 골라 되살립니다.'],
  ['minstrel', '음유시인', 'Minstrel', T, '하수인이 처형당한 날 밤, 모든 플레이어(당신 제외)는 내일 낮 종료까지 취합니다.'],
  ['tealady', '찻집 여주인', 'Tea Lady', T, '양쪽 이웃이 모두 선하면 그 둘은 죽지 않습니다.'],
  ['pacifist', '평화주의자', 'Pacifist', T, '처형당할 선한 플레이어가 살 수도 있습니다.'],
  ['fool', '바보', 'Fool', T, '처음 죽을 때 죽지 않습니다.'],
  ['goon', '깡패', 'Goon', O, '매 밤, 처음으로 당신을 선택한 플레이어는 취합니다. 당신은 그 사람의 진영으로 바뀝니다.'],
  ['lunatic', '광인', 'Lunatic', O, '자신이 악마라고 생각하지만 아닙니다. 악마는 당신이 누구를 골랐는지 알게 됩니다.'],
  ['tinker', '땜장이', 'Tinker', O, '언제든 죽을 수 있습니다.'],
  ['moonchild', '달의 아이', 'Moonchild', O, '죽었을 때 한 명을 공개적으로 고릅니다. 그가 선하면 오늘 밤 그가 죽습니다.'],
  ['godfather', '대부', 'Godfather', M, '첫날 밤, 어떤 아웃사이더가 있는지 알게 됩니다. 낮에 아웃사이더가 죽으면 그날 밤 한 명을 죽입니다.'],
  ['devilsadvocate', '악마의 대변인', "Devil's Advocate", M, '매 밤, 살아있는 플레이어 한 명을 골라 내일 처형당해도 죽지 않습니다. 같은 사람을 연속으로 고를 수 없습니다.'],
  ['assassin', '암살자', 'Assassin', M, '게임 중 한 번, 밤에 한 명을 골라 죽입니다. 방어 능력도 무시합니다.'],
  ['mastermind', '흑막', 'Mastermind', M, '악마가 처형으로 죽으면 하루를 더 진행합니다. 그날 처형당한 선한 플레이어가 있으면 악이 승리합니다.'],
  ['zombuul', '좀불', 'Zombuul', D, '매 밤(첫날 제외), 아무도 처형당하지 않았다면 한 명을 죽입니다. 처음 죽으면 살아있는 것으로 취급됩니다.'],
  ['pukka', '푸카', 'Pukka', D, '매 밤, 한 명을 골라 독살합니다. 전날 밤 독살된 사람은 죽고 중독에서 풀려납니다.'],
  ['shabaloth', '샤발로스', 'Shabaloth', D, '매 밤(첫날 제외), 두 명을 골라 죽입니다. 전날 죽은 사람 중 한 명이 되살아날 수 있습니다.'],
  ['po', '포', 'Po', D, '밤에 아무도 죽이지 않으면 다음 밤엔 세 명을 죽입니다.'],

  // ───── Sects & Violets ─────
  ['clockmaker', '시계공', 'Clockmaker', T, '첫날 밤, 악마와 가장 가까운 하수인 사이의 거리를 알게 됩니다.'],
  ['dreamer', '몽상가', 'Dreamer', T, '매 밤, 한 명을 골라 선한 직업 하나와 악한 직업 하나를 알게 됩니다. 둘 중 하나가 그의 직업입니다.'],
  ['snakecharmer', '뱀 부리는 사람', 'Snake Charmer', T, '매 밤, 살아있는 플레이어 한 명을 고릅니다. 악마를 골랐다면 둘의 직업과 진영이 서로 바뀌고 새 악마는 중독됩니다.'],
  ['mathematician', '수학자', 'Mathematician', T, '매 밤, 이번 밤에 능력이 오작동한 플레이어가 몇 명인지 알게 됩니다.'],
  ['flowergirl', '꽃 파는 소녀', 'Flowergirl', T, '매 밤(첫날 제외), 오늘 낮 악마가 투표했는지 알게 됩니다.'],
  ['towncrier', '소식통', 'Town Crier', T, '매 밤(첫날 제외), 오늘 낮 하수인이 누군가를 지목했는지 알게 됩니다.'],
  ['oracle', '신탁자', 'Oracle', T, '매 밤(첫날 제외), 죽은 플레이어 중 악이 몇 명인지 알게 됩니다.'],
  ['savant', '박식가', 'Savant', T, '매 낮, 이야기꾼을 찾아 두 가지 정보(하나는 참, 하나는 거짓)를 얻을 수 있습니다.'],
  ['seamstress', '재봉사', 'Seamstress', T, '게임 중 한 번, 밤에 두 명을 골라 둘이 같은 진영인지 알게 됩니다.'],
  ['philosopher', '철학자', 'Philosopher', T, '게임 중 한 번, 밤에 선한 직업 하나를 골라 그 능력을 얻습니다. 해당 직업 플레이어는 취합니다.'],
  ['artist', '화가', 'Artist', T, '게임 중 한 번, 낮에 이야기꾼에게 예/아니오로 답할 수 있는 질문을 합니다.'],
  ['juggler', '저글러', 'Juggler', T, '첫날 낮, 공개적으로 최대 5명의 직업을 추측합니다. 그날 밤 몇 개가 맞았는지 알게 됩니다.'],
  ['sage', '현자', 'Sage', T, '악마에게 죽으면 그날 밤 두 명 중 하나가 악마임을 알게 됩니다.'],
  ['mutant', '돌연변이', 'Mutant', O, '아웃사이더라고 공개적으로 주장하면 처형당할 수 있습니다.'],
  ['sweetheart', '연인', 'Sweetheart', O, '죽으면 한 명이 영구적으로 취합니다.'],
  ['barber', '이발사', 'Barber', O, '죽으면 악마가 두 플레이어의 직업을 맞바꿀 수 있습니다.'],
  ['klutz', '서투른 자', 'Klutz', O, '죽으면 살아있는 플레이어 한 명을 공개적으로 고릅니다. 그가 악이면 선한 팀이 패배합니다.'],
  ['eviltwin', '악의 쌍둥이', 'Evil Twin', M, '선한 쌍둥이와 서로를 알고 있습니다. 선한 쪽이 처형당하면 악이 승리하고, 둘 다 살아있으면 선이 이길 수 없습니다.'],
  ['witch', '마녀', 'Witch', M, '매 밤, 한 명을 저주합니다. 저주받은 사람이 내일 낮 지목을 하면 죽습니다. 생존자가 3명이면 힘을 잃습니다.'],
  ['cerenovus', '세레노부스', 'Cerenovus', M, '매 밤, 한 명을 골라 내일 낮 특정 직업이라고 주장하게 합니다. 거부하면 미칠 수 있습니다.'],
  ['pithag', '피트 해그', 'Pit-Hag', M, '매 밤, 한 명과 직업 하나를 골라 그 직업으로 바꿉니다. 새 악마가 생기면 그날 밤 죽는 사람은 이야기꾼이 정합니다.'],
  ['fanggu', '팽구', 'Fang Gu', D, '매 밤(첫날 제외), 한 명을 죽입니다. 처음으로 아웃사이더를 죽이면 그 사람이 새 팽구가 되고 당신이 죽습니다.'],
  ['vigormortis', '비고르모티스', 'Vigormortis', D, '매 밤(첫날 제외), 한 명을 죽입니다. 죽은 하수인은 능력을 유지하며 이웃 마을 주민 한 명을 중독시킵니다.'],
  ['nodashii', '노 다시', 'No Dashii', D, '매 밤(첫날 제외), 한 명을 죽입니다. 양쪽 이웃 마을 주민 둘은 중독됩니다.'],
  ['vortox', '보르톡스', 'Vortox', D, '매 밤(첫날 제외), 한 명을 죽입니다. 마을 주민의 능력은 거짓 정보를 줍니다. 처형이 없으면 악이 승리합니다.'],
]

export const ROLES: Record<string, Role> = Object.fromEntries(
  rows.map(([id, ko, en, team, ability]) => [id, { id, ko, en, team, ability }]),
)

const ids = (...r: string[]) => r

export const SCRIPTS: Script[] = [
  {
    id: 'tb',
    name: '고통의 조제 (Trouble Brewing)',
    roles: ids(
      'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk',
      'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor', 'butler', 'drunk', 'recluse', 'saint',
      'poisoner', 'spy', 'scarletwoman', 'baron', 'imp',
    ),
  },
  {
    id: 'bmr',
    name: '피의 달이 뜨다 (Bad Moon Rising)',
    roles: ids(
      'grandmother', 'sailor', 'chambermaid', 'exorcist', 'innkeeper', 'gambler', 'gossip', 'courtier',
      'professor', 'minstrel', 'tealady', 'pacifist', 'fool', 'goon', 'lunatic', 'tinker', 'moonchild',
      'godfather', 'devilsadvocate', 'assassin', 'mastermind', 'zombuul', 'pukka', 'shabaloth', 'po',
    ),
  },
  {
    id: 'sv',
    name: '종파와 제비꽃 (Sects & Violets)',
    roles: ids(
      'clockmaker', 'dreamer', 'snakecharmer', 'mathematician', 'flowergirl', 'towncrier', 'oracle', 'savant',
      'seamstress', 'philosopher', 'artist', 'juggler', 'sage', 'mutant', 'sweetheart', 'barber', 'klutz',
      'eviltwin', 'witch', 'cerenovus', 'pithag', 'fanggu', 'vigormortis', 'nodashii', 'vortox',
    ),
  },
]

export const getScript = (id: string) => SCRIPTS.find((s) => s.id === id) ?? SCRIPTS[0]

// 인원별 [마을 주민, 아웃사이더, 하수인, 악마]
export const DISTRIBUTION: Record<number, [number, number, number, number]> = {
  5: [3, 0, 1, 1],
  6: [3, 1, 1, 1],
  7: [5, 0, 1, 1],
  8: [5, 1, 1, 1],
  9: [5, 2, 1, 1],
  10: [7, 0, 2, 1],
  11: [7, 1, 2, 1],
  12: [7, 2, 2, 1],
  13: [9, 0, 3, 1],
  14: [9, 1, 3, 1],
  15: [9, 2, 3, 1],
}
