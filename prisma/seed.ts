import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ──────────────────────────────────────────────────────────────────────────
// Стартовый справочник «СтокПоиск» — под реальный спрос из чатов реселлеров.
// Мультикатегория с запасом. Дальше расширяет администратор.
// Скрипт идемпотентный (upsert): повторный запуск не плодит дубликатов.
// ──────────────────────────────────────────────────────────────────────────

// Дерево категорий: top → подкатегории (parent по slug).
const categories: { name: string; slug: string; parent?: string }[] = [
  { name: 'Обувь', slug: 'footwear' },
  { name: 'Одежда', slug: 'apparel' },
  { name: 'Аксессуары', slug: 'accessories' },
  { name: 'Часы', slug: 'watches', parent: 'accessories' },
  { name: 'Сумки', slug: 'bags', parent: 'accessories' },
  { name: 'Головные уборы', slug: 'headwear', parent: 'accessories' },
  { name: 'Украшения', slug: 'jewelry', parent: 'accessories' },
  { name: 'Коллекционное', slug: 'collectibles' },
]

// Бренды с алиасами (сленг/транслит/сокращения).
const brands: { name: string; aliases?: string[] }[] = [
  { name: 'Nike', aliases: ['найк', 'найки'] },
  { name: 'Jordan', aliases: ['джордан', 'дж', 'aj', 'аж'] },
  { name: 'adidas', aliases: ['адидас', 'адик'] },
  { name: 'Yeezy', aliases: ['изи', 'yzy', 'изи буст'] },
  { name: 'New Balance', aliases: ['nb', 'нб', 'нью баланс', 'ньюбаланс'] },
  { name: 'Asics', aliases: ['асикс'] },
  { name: 'Salomon', aliases: ['саломон'] },
  { name: 'Puma', aliases: ['пума'] },
  { name: 'Reebok', aliases: ['рибок'] },
  { name: 'Vans', aliases: ['ванс'] },
  { name: 'Converse', aliases: ['конверс', 'чак'] },
  { name: 'UGG', aliases: ['угг', 'угги'] },
  { name: 'Crocs', aliases: ['крокс'] },
  { name: 'Travis Scott', aliases: ['трэвис', 'тревис', 'cactus jack', 'кактус джек', 'cj', 'ts'] },
  { name: 'Supreme', aliases: ['суприм', 'суп'] },
  { name: 'Stone Island', aliases: ['стон айленд', 'стоник'] },
  { name: 'C.P. Company', aliases: ['cp company', 'сипи'] },
  { name: 'The North Face', aliases: ['tnf', 'тнф', 'норт фейс'] },
  { name: 'Stussy', aliases: ['стусси'] },
  { name: 'Hermès', aliases: ['hermes', 'гермес', 'эрмес', 'армес'] },
  { name: 'Louis Vuitton', aliases: ['lv', 'луи', 'луи витон', 'витон'] },
  { name: 'Gucci', aliases: ['гучи', 'гуччи'] },
  { name: 'Balenciaga', aliases: ['баленсиага', 'валенсяга', 'балон'] },
  { name: 'Bottega Veneta', aliases: ['боттега', 'бетон', 'bottega'] },
  { name: 'Prada', aliases: ['прада'] },
  { name: 'Dior', aliases: ['диор'] },
  { name: 'Chanel', aliases: ['шанель'] },
  { name: 'Cartier', aliases: ['картье', 'картьє'] },
  { name: 'Van Cleef & Arpels', aliases: ['van cleef', 'ван клиф'] },
  { name: 'Rolex', aliases: ['ролекс', 'ролик'] },
  { name: 'Audemars Piguet', aliases: ['ap', 'ап', 'апэшка'] },
  { name: 'Casio', aliases: ['касио', 'g-shock', 'джишок'] },
  { name: 'New Era', aliases: ['нью эра'] },
  { name: 'Pop Mart', aliases: ['popmart', 'labubu', 'лабубу', 'поп март'] },
  { name: 'Off-White', aliases: ['офф вайт', 'off white', 'ow'] },
  { name: 'A Bathing Ape', aliases: ['bape', 'бейп', 'бэйп'] },
  { name: 'Palm Angels', aliases: ['палм анджелс'] },
  { name: "Arc'teryx", aliases: ['арктерикс'] },
  { name: 'Moncler', aliases: ['монклер'] },
  { name: 'Canada Goose', aliases: ['канада гус', 'кэнада гус'] },
  { name: 'Birkenstock', aliases: ['биркенсток', 'бирки'] },
  { name: 'Common Projects', aliases: ['коммон проджектс'] },
  { name: 'Timberland', aliases: ['тимберленд'] },
  { name: 'Onitsuka Tiger', aliases: ['онитсука', 'онитсука тайгер'] },
]

// Модели: бренд, slug категории, имя, (опц.) алиасы и артикул.
const models: { brand: string; category: string; name: string; aliases?: string[]; sku?: string }[] = [
  // Nike — обувь
  { brand: 'Nike', category: 'footwear', name: 'Air Force 1', aliases: ['af1', 'аф1', 'форсы', 'аир форс'], sku: 'CW2288-111' },
  { brand: 'Nike', category: 'footwear', name: 'Dunk Low', aliases: ['данк лоу', 'данк'], sku: 'DD1391-100' },
  { brand: 'Nike', category: 'footwear', name: 'Dunk High', aliases: ['данк хай'] },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 90', aliases: ['аир макс 90'], sku: 'CT1685-100' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 95' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 97', sku: '884421-001' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max Plus', aliases: ['tn', 'тн', 'плюсы'] },
  { brand: 'Nike', category: 'footwear', name: 'Cortez', aliases: ['кортез'] },
  { brand: 'Nike', category: 'footwear', name: 'Vomero 5', aliases: ['вомеро'] },
  { brand: 'Nike', category: 'footwear', name: 'P-6000' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 1', aliases: ['аир макс 1', 'am1'] },
  { brand: 'Nike', category: 'footwear', name: 'Shox R4', aliases: ['шокс', 'shox'] },
  { brand: 'Nike', category: 'footwear', name: 'Blazer Mid 77', aliases: ['блейзер'] },
  // Nike — одежда
  { brand: 'Nike', category: 'apparel', name: 'Tech Fleece', aliases: ['тех флис', 'технолоджи'] },
  { brand: 'Nike', category: 'apparel', name: 'Windrunner' },
  // Jordan — обувь
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 Low', aliases: ['aj1 low', 'дж1 лоу', 'джордан 1 лоу'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 Mid', aliases: ['aj1 mid', 'дж1 мид'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 High', aliases: ['aj1 high', 'дж1 хай'], sku: 'DZ5485-612' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 3', aliases: ['дж3'], sku: 'CT8532-106' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 4', aliases: ['дж4', 'aj4'], sku: '840606-192' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 5', aliases: ['дж5'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 6', aliases: ['дж6'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 11', aliases: ['дж11'], sku: '378037-061' },
  // adidas — обувь
  { brand: 'adidas', category: 'footwear', name: 'Samba', aliases: ['самба'], sku: 'B75806' },
  { brand: 'adidas', category: 'footwear', name: 'Gazelle', aliases: ['газель'], sku: 'BB5478' },
  { brand: 'adidas', category: 'footwear', name: 'Campus 00s', aliases: ['кампус'], sku: 'B22533' },
  { brand: 'adidas', category: 'footwear', name: 'Superstar', aliases: ['суперстар'], sku: 'C77124' },
  { brand: 'adidas', category: 'footwear', name: 'Stan Smith', aliases: ['стэн смит'], sku: 'M20324' },
  { brand: 'adidas', category: 'footwear', name: 'Forum Low', aliases: ['форум'] },
  { brand: 'adidas', category: 'footwear', name: 'Handball Spezial', aliases: ['хэндбол специал', 'hb spezial', 'спезиаль'] },
  { brand: 'adidas', category: 'footwear', name: 'Ultraboost', aliases: ['ультрабуст'] },
  // Yeezy — обувь
  { brand: 'Yeezy', category: 'footwear', name: 'Boost 350 V2', aliases: ['350', 'изи 350'], sku: 'CP9654' },
  { brand: 'Yeezy', category: 'footwear', name: 'Boost 700', aliases: ['700', 'изи 700'], sku: 'B75571' },
  { brand: 'Yeezy', category: 'footwear', name: 'Slide', aliases: ['изи слайд', 'слайды'] },
  { brand: 'Yeezy', category: 'footwear', name: 'Foam Runner', aliases: ['фоам', 'фоам раннер'] },
  // New Balance — обувь
  { brand: 'New Balance', category: 'footwear', name: '2002R', aliases: ['2002', 'm2002r'], sku: 'M2002RDA' },
  { brand: 'New Balance', category: 'footwear', name: '1906R', aliases: ['1906', 'm1906r'] },
  { brand: 'New Balance', category: 'footwear', name: '1906D', aliases: ['m1906d'], sku: 'M1906D' },
  { brand: 'New Balance', category: 'footwear', name: '990', aliases: ['990v3', '990v4', '990v5', '990v6'] },
  { brand: 'New Balance', category: 'footwear', name: '9060' },
  { brand: 'New Balance', category: 'footwear', name: '550', sku: 'BB550WT1' },
  { brand: 'New Balance', category: 'footwear', name: '530' },
  { brand: 'New Balance', category: 'footwear', name: '327' },
  { brand: 'New Balance', category: 'footwear', name: '574', aliases: ['574'] },
  { brand: 'New Balance', category: 'footwear', name: '993', aliases: ['993'] },
  // Asics / Salomon / Puma / Reebok / Vans / Converse — обувь
  { brand: 'Asics', category: 'footwear', name: 'Gel-Kayano 14', aliases: ['каяно', 'kayano 14'] },
  { brand: 'Asics', category: 'footwear', name: 'Gel-1130' },
  { brand: 'Asics', category: 'footwear', name: 'Gel-NYC' },
  { brand: 'Asics', category: 'footwear', name: 'Gel-Lyte III' },
  { brand: 'Salomon', category: 'footwear', name: 'XT-6', aliases: ['xt6'] },
  { brand: 'Salomon', category: 'footwear', name: 'XT-4' },
  { brand: 'Puma', category: 'footwear', name: 'Speedcat', aliases: ['спидкэт'] },
  { brand: 'Puma', category: 'footwear', name: 'Palermo' },
  { brand: 'Reebok', category: 'footwear', name: 'Club C 85' },
  { brand: 'Vans', category: 'footwear', name: 'Old Skool', aliases: ['олд скул'], sku: 'VN000D3HY28' },
  { brand: 'Vans', category: 'footwear', name: 'Knu Skool', aliases: ['кню скул'] },
  { brand: 'Converse', category: 'footwear', name: 'Chuck 70', aliases: ['чак 70'], sku: '162050C' },
  // UGG / Crocs — обувь
  { brand: 'UGG', category: 'footwear', name: 'Tazz', aliases: ['тазз'] },
  { brand: 'UGG', category: 'footwear', name: 'Classic Mini', aliases: ['классик мини'] },
  { brand: 'Crocs', category: 'footwear', name: 'Classic Clog', aliases: ['классик'], sku: '10001-001' },
  // Travis Scott — коллабы
  { brand: 'Travis Scott', category: 'footwear', name: 'Air Jordan 1 Low TS', aliases: ['тревис джордан 1', 'ts aj1 low'] },
  { brand: 'Travis Scott', category: 'apparel', name: 'Cactus Jack Hoodie', aliases: ['кактус джек худи'] },
  // Одежда
  { brand: 'Supreme', category: 'apparel', name: 'Box Logo Hoodie', aliases: ['бокс лого', 'bogo'] },
  { brand: 'Supreme', category: 'apparel', name: 'Box Logo Tee' },
  { brand: 'Stone Island', category: 'apparel', name: 'Sweatshirt' },
  { brand: 'Stone Island', category: 'apparel', name: 'Overshirt' },
  { brand: 'C.P. Company', category: 'apparel', name: 'Goggle Jacket', aliases: ['гогл'] },
  { brand: 'The North Face', category: 'apparel', name: 'Nuptse Jacket', aliases: ['нупсе', 'пуховик норт фейс'] },
  { brand: 'Stussy', category: 'apparel', name: 'Basic Logo Tee' },
  // Аксессуары — часы
  { brand: 'Audemars Piguet', category: 'watches', name: 'AP x Swatch', aliases: ['ап свотч', 'ap swatch'] },
  { brand: 'Audemars Piguet', category: 'watches', name: 'Royal Oak', aliases: ['роял оук'], sku: '15500ST.OO.1220ST.01' },
  { brand: 'Rolex', category: 'watches', name: 'Submariner', aliases: ['сабмаринер'], sku: '124060' },
  { brand: 'Rolex', category: 'watches', name: 'Daytona', aliases: ['дайтона'], sku: '116500LN' },
  { brand: 'Casio', category: 'watches', name: 'G-Shock', aliases: ['джишок', 'gshock'], sku: 'DW5600E-1V' },
  // Аксессуары — сумки
  { brand: 'Hermès', category: 'bags', name: 'Birkin', aliases: ['биркин'] },
  { brand: 'Hermès', category: 'bags', name: 'Kelly', aliases: ['келли'] },
  { brand: 'Louis Vuitton', category: 'bags', name: 'Keepall', aliases: ['кипол'] },
  { brand: 'Gucci', category: 'bags', name: 'GG Marmont', aliases: ['мармонт'] },
  { brand: 'Balenciaga', category: 'bags', name: 'Le Cagole' },
  { brand: 'Bottega Veneta', category: 'bags', name: 'Cassette', aliases: ['кассета'] },
  { brand: 'Prada', category: 'bags', name: 'Re-Edition', aliases: ['ре-эдишн'] },
  // Аксессуары — украшения
  { brand: 'Cartier', category: 'jewelry', name: 'Love Bracelet', aliases: ['лав браслет'] },
  { brand: 'Van Cleef & Arpels', category: 'jewelry', name: 'Alhambra', aliases: ['альгамбра', 'клевер'] },
  // Аксессуары — головные уборы
  { brand: 'New Era', category: 'headwear', name: '59FIFTY Cap', aliases: ['кепка', 'снепбек'] },
  // Коллекционное
  { brand: 'Pop Mart', category: 'collectibles', name: 'Labubu The Monsters', aliases: ['лабубу', 'labubu'] },
  // Off-White
  { brand: 'Off-White', category: 'footwear', name: 'Out Of Office', aliases: ['ооо', 'out of office'] },
  { brand: 'Off-White', category: 'apparel', name: 'Arrows Hoodie', aliases: ['эрроус худи', 'стрелки худи'] },
  // A Bathing Ape (BAPE)
  { brand: 'A Bathing Ape', category: 'apparel', name: 'Shark Full Zip Hoodie', aliases: ['шарк худи', 'акула худи'] },
  { brand: 'A Bathing Ape', category: 'footwear', name: 'Bapesta', aliases: ['бэйпста'] },
  // Palm Angels
  { brand: 'Palm Angels', category: 'apparel', name: 'Track Pants', aliases: ['палм трек'] },
  // Arc'teryx
  { brand: "Arc'teryx", category: 'apparel', name: 'Beta Jacket', aliases: ['бета джекет', 'арктерикс бета'] },
  { brand: "Arc'teryx", category: 'apparel', name: 'Atom Hoody', aliases: ['атом худи'] },
  // Moncler
  { brand: 'Moncler', category: 'apparel', name: 'Maya Jacket', aliases: ['майя', 'монклер майя'] },
  // Canada Goose
  { brand: 'Canada Goose', category: 'apparel', name: 'Expedition Parka', aliases: ['экспедишн', 'канада гус парка'] },
  // Birkenstock
  { brand: 'Birkenstock', category: 'footwear', name: 'Boston', aliases: ['бостон'] },
  { brand: 'Birkenstock', category: 'footwear', name: 'Arizona', aliases: ['аризона'] },
  // Common Projects
  { brand: 'Common Projects', category: 'footwear', name: 'Achilles Low', aliases: ['ахиллес', 'ахилес'] },
  // Timberland
  { brand: 'Timberland', category: 'footwear', name: '6 Inch Premium Boot', aliases: ['тимбы', 'тимберленды'] },
  // Onitsuka Tiger
  { brand: 'Onitsuka Tiger', category: 'footwear', name: 'Mexico 66', aliases: ['мексико 66', 'онитсука мексико'] },
]

async function main() {
  // 1) Категории: сначала корневые, потом дочерние (parent уже существует).
  const catId: Record<string, number> = {}
  for (const c of categories.filter((c) => !c.parent)) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    })
    catId[c.slug] = row.id
  }
  for (const c of categories.filter((c) => c.parent)) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, parentId: catId[c.parent!] },
      create: { name: c.name, slug: c.slug, parentId: catId[c.parent!] },
    })
    catId[c.slug] = row.id
  }

  // 2) Бренды.
  const brandId: Record<string, number> = {}
  for (const b of brands) {
    const row = await prisma.brand.upsert({
      where: { name: b.name },
      update: { aliases: b.aliases ?? [] },
      create: { name: b.name, aliases: b.aliases ?? [] },
    })
    brandId[b.name] = row.id
  }

  // 3) Модели.
  for (const m of models) {
    await prisma.model.upsert({
      where: { brandId_name: { brandId: brandId[m.brand], name: m.name } },
      update: { categoryId: catId[m.category], aliases: m.aliases ?? [], sku: m.sku ?? null },
      create: {
        brandId: brandId[m.brand],
        categoryId: catId[m.category],
        name: m.name,
        aliases: m.aliases ?? [],
        sku: m.sku ?? null,
      },
    })
  }

  const [cCat, cBrand, cModel] = await Promise.all([
    prisma.category.count(),
    prisma.brand.count(),
    prisma.model.count(),
  ])
  console.log(`Справочник готов: категорий ${cCat}, брендов ${cBrand}, моделей ${cModel}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
