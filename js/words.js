export const categories = {
  characters: { label: 'People', icon: '♙', pairs: [
    ['David','Solomon'],['Moses','Joshua'],['Peter','Paul'],['Abraham','Isaac'],['Jacob','Joseph'],['Esther','Ruth'],['Mary Magdalene','Martha'],['Elijah','Elisha'],['Noah','Jonah'],['Daniel','Joseph'],['Deborah','Esther'],['Samuel','Nathan'],['John the Baptist','Peter'],['Nehemiah','Ezra'],['Gideon','Samson'],['Aaron','Miriam'],['Eve','Sarah'],['Isaiah','Jeremiah'],['Mary','Elizabeth'],['Thomas','Andrew'],['Lydia','Priscilla'],['Hannah','Ruth'],['Caleb','Joshua'],['Abigail','Bathsheba']
  ]},
  places: { label: 'Places', icon: '⌂', pairs: [
    ['Bethlehem','Nazareth'],['Jerusalem','Jericho'],['Galilee','Samaria'],['Egypt','Babylon'],['Mount Sinai','Mount Carmel'],['Jordan River','Red Sea'],['Garden of Eden','Gethsemane'],['Capernaum','Bethsaida'],['Jerusalem','Bethlehem'],['Nineveh','Babylon'],['Mount of Olives','Mount Sinai'],['Cana','Nazareth'],['Joppa','Caesarea'],['Hebron','Bethel'],['Wilderness','Promised Land'],['Patmos','Antioch'],['Sea of Galilee','Dead Sea'],['Shiloh','Jerusalem'],['Damascus','Jericho'],['Emmaus','Bethany']
  ]},
  events: { label: 'Events', icon: '✦', pairs: [
    ['Creation','The Flood'],['The Exodus','The Exile'],['Parting of the Red Sea','Crossing the Jordan'],['Pentecost','Resurrection'],['The Last Supper','Wedding at Cana'],['The Fall','The Flood'],['Birth of Jesus','Resurrection'],['David and Goliath','Daniel in the lions’ den'],['Jesus’ baptism','Transfiguration'],['Tower of Babel','Day of Pentecost'],['The Ascension','The Nativity'],['Passover','Pentecost'],['Walls of Jericho','Parting of the Red Sea'],['Crucifixion','Resurrection'],['Call of Abraham','Call of Moses'],['Paul’s conversion','Peter’s escape from prison'],['The Good Samaritan','The Prodigal Son'],['Manna in the wilderness','Water from the rock']
  ]},
  objects: { label: 'Objects', icon: '♧', pairs: [
    ['Ark','Tabernacle'],['Sling','Staff'],['Crown','Sceptre'],['Scroll','Book'],['Lamp','Candle'],['Cross','Empty tomb'],['Trumpet','Harp'],['Stone tablets','Scroll'],['Manger','Fishing net'],['Altar','Incense'],['Goliath’s armour','David’s sling'],['Robe of many colours','Joseph’s silver cup'],['Oil jar','Loaves and fish'],['Ruth’s sheaf','Moses’ basket'],['Lion’s den','Fiery furnace'],['Mustard seed','Pearl'],['Ten coins','Lost sheep'],['Washing basin','Water jar']
  ]},
  concepts: { label: 'Faith & life', icon: '♡', pairs: [
    ['Faith','Hope'],['Grace','Mercy'],['Prayer','Worship'],['Forgiveness','Reconciliation'],['Wisdom','Knowledge'],['Salvation','Redemption'],['Love','Compassion'],['Covenant','Promise'],['Justice','Righteousness'],['Patience','Perseverance'],['Joy','Peace'],['Repentance','Obedience'],['Fellowship','Hospitality'],['Humility','Service'],['Truth','Light'],['Courage','Faithfulness'],['Thanksgiving','Praise'],['Generosity','Stewardship']
  ]},
  teachings: { label: 'Parables & teachings', icon: '☼', pairs: [
    ['The Good Samaritan','The Prodigal Son'],['The Lost Sheep','The Lost Coin'],['The Sower','The Mustard Seed'],['The Beatitudes','The Lord’s Prayer'],['The Good Shepherd','The True Vine'],['The Wise and Foolish Builders','The Ten Virgins'],['The Pearl of Great Price','The Hidden Treasure'],['The Great Commission','The Golden Rule'],['The Wedding Banquet','The Workers in the Vineyard'],['The Pharisee and the Tax Collector','The Persistent Widow'],['Love your neighbour','Love your enemies'],['Salt and light','A lamp on a stand']
  ]},
  miracles: { label: 'Miracles', icon: '✧', pairs: [
    ['Water into wine','Feeding the five thousand'],['Healing the blind man','Healing the paralysed man'],['Walking on water','Calming the storm'],['Raising Lazarus','Raising Jairus’ daughter'],['Healing the leper','Healing the woman who touched his cloak'],['Manna from heaven','Water from the rock'],['The catch of fish','The healing at the pool of Bethesda'],['Parting the Red Sea','Crossing the Jordan'],['Elijah and the widow’s oil','Elisha and the floating axe head'],['The Exodus plagues','The fiery furnace'],['Peter’s prison escape','Paul and Silas in prison'],['Feeding the four thousand','Feeding the five thousand']
  ]},
  books: { label: 'Books of the Bible', icon: '▤', pairs: [
    ['Genesis','Exodus'],['Psalms','Proverbs'],['Matthew','Mark'],['Luke','John'],['Romans','Galatians'],['Ruth','Esther'],['Isaiah','Jeremiah'],['Acts','Romans'],['1 Samuel','2 Samuel'],['Ephesians','Philippians'],['James','Jude'],['Revelation','Daniel'],['Jonah','Micah'],['Colossians','Ephesians'],['Hebrews','James'],['Job','Ecclesiastes']
  ]},
  peopleAndStories: { label: 'People & stories', icon: '⌘', pairs: [
    ['David and Goliath','Samson and Delilah'],['Noah and the ark','Moses and the basket'],['Daniel and the lions’ den','Shadrach, Meshach and Abednego'],['Joseph and his brothers','Jacob and Esau'],['Ruth and Naomi','Mary and Martha'],['Elijah on Mount Carmel','Moses at Mount Sinai'],['Peter and the rooster','Thomas and the empty tomb'],['Esther and the king','Nehemiah and the wall'],['Abraham and Isaac','Elisha and the Shunammite woman'],['Paul and Silas','Philip and the Ethiopian official'],['Jonah and Nineveh','Jesus and Zacchaeus'],['The Samaritan woman','Nicodemus']
  ]}
};

export const individualWords = Object.fromEntries(Object.entries(categories).map(([key, group]) => [key, [...new Set(group.pairs.flatMap(([a,b]) => [a,b]))]]));
export const ALL_CATEGORIES = Object.keys(categories);

export function getPairs(selected, customWords = []) {
  const keys = selected.length ? selected : ALL_CATEGORIES;
  const pairs = keys.flatMap(key => (categories[key]?.pairs ?? []).map(([civilian, imposter]) => ({ civilian, imposter, category: key })));
  const custom = cleanCustomWords(customWords);
  for (let i = 0; i + 1 < custom.length; i += 2) pairs.push({ civilian: custom[i], imposter: custom[i+1], category: 'custom' });
  const seen = new Set();
  return pairs.filter(pair => {
    if (!validWord(pair.civilian) || !validWord(pair.imposter) || pair.civilian.toLocaleLowerCase() === pair.imposter.toLocaleLowerCase()) return false;
    const key = [pair.civilian, pair.imposter].map(v => v.toLocaleLowerCase()).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function getWords(selected, customWords = []) {
  const keys = selected.length ? selected : ALL_CATEGORIES;
  const words = keys.flatMap(key => individualWords[key] ?? []);
  if (keys.includes('custom')) words.push(...cleanCustomWords(customWords));
  return [...new Map(words.filter(validWord).map(word => [word.toLocaleLowerCase(), word])).values()];
}
export function validWord(word) { return typeof word === 'string' && word.trim().length > 0 && word.trim().length <= 60; }
export function cleanCustomWords(words) { return [...new Map((words ?? []).filter(validWord).map(w => [w.trim().toLocaleLowerCase(), w.trim()])).values()]; }
