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

// Модели: бренд, slug категории, имя, (опц.) алиасы, артикул и паспорт
// (colorway соответствует sku, releaseYear — год силуэта; ТОЛЬКО проверенные
// факты). retailPrice сид НЕ заполняет: официального ритейла в РФ нет — цену
// вводит админ вручную, честный null лучше выдуманного числа.
const models: { brand: string; category: string; name: string; aliases?: string[]; sku?: string; colorway?: string; releaseYear?: number; description?: string }[] = [
  // Nike — обувь
  { brand: 'Nike', category: 'footwear', name: 'Air Force 1', aliases: ['af1', 'аф1', 'форсы', 'аир форс'], sku: 'CW2288-111', colorway: 'White/White', releaseYear: 1982, description: 'Баскетбольная модель Брюса Килгора 1982 года — первые кроссовки с амортизацией Nike Air. Давно ушла с площадок на улицы; полностью белая версия — вечная классика и самая тиражная модель Nike.' },
  { brand: 'Nike', category: 'footwear', name: 'Dunk Low', aliases: ['данк лоу', 'данк'], sku: 'DD1391-100', colorway: 'White/Black «Panda»', releaseYear: 1985, description: 'Создан в 1985-м для студенческого баскетбола NCAA, в 2020-х пережил второе рождение как главный уличный силуэт. «Panda» — самая массовая расцветка.' },
  { brand: 'Nike', category: 'footwear', name: 'Dunk High', aliases: ['данк хай'], releaseYear: 1985 },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 90', aliases: ['аир макс 90'], sku: 'CT1685-100', releaseYear: 1990, description: 'Классика Тинкера Хэтфилда с видимой капсулой Air в пятке — один из главных силуэтов линейки Air Max.' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 95', releaseYear: 1995, description: 'Дизайн Серхио Лозано, вдохновлённый анатомией: градиентные слои-«мышцы» и скрытая шнуровка.' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 97', sku: '884421-001', colorway: 'Metallic Silver «Silver Bullet»', releaseYear: 1997, description: 'Волнообразный дизайн Кристиана Трессера с полноразмерной капсулой Air; серебристая «Silver Bullet» — визитная карточка модели.' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max Plus', aliases: ['tn', 'тн', 'плюсы'], releaseYear: 1998, description: 'Известен как TN (Tuned Air): агрессивный каркас-«скелет» поверх градиентной сетки. Культовый статус на улицах Европы.' },
  { brand: 'Nike', category: 'footwear', name: 'Cortez', aliases: ['кортез'], releaseYear: 1972, description: 'Беговая модель Билла Бауэрмана — один из первых силуэтов Nike.' },
  { brand: 'Nike', category: 'footwear', name: 'Vomero 5', aliases: ['вомеро'] },
  { brand: 'Nike', category: 'footwear', name: 'P-6000', releaseYear: 2019, description: 'Гибрид беговых Pegasus середины 2000-х: металлик, сетка и Y2K-детали.' },
  { brand: 'Nike', category: 'footwear', name: 'Air Max 1', aliases: ['аир макс 1', 'am1'], releaseYear: 1987, description: 'Первые кроссовки с видимой капсулой Air — идея Тинкера Хэтфилда, вдохновлённая центром Помпиду.' },
  { brand: 'Nike', category: 'footwear', name: 'Shox R4', aliases: ['шокс', 'shox'], releaseYear: 2000, description: 'Флагман механической амортизации Shox на колоннах — символ эпохи Y2K.' },
  { brand: 'Nike', category: 'footwear', name: 'Blazer Mid 77', aliases: ['блейзер'], description: 'Один из первых баскетбольных силуэтов Nike начала 1970-х в винтажной отделке образца 1977 года.' },
  // Nike — одежда
  { brand: 'Nike', category: 'apparel', name: 'Tech Fleece', aliases: ['тех флис', 'технолоджи'], releaseYear: 2013, description: 'Линейка Nike Sportswear из лёгкого двухслойного флиса: зауженные джоггеры и худи — база уличного гардероба.' },
  { brand: 'Nike', category: 'apparel', name: 'Windrunner', releaseYear: 1978, description: 'Ветровка с фирменным шевроном на груди, выпускается с 1978 года.' },
  // Jordan — обувь
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 Low', aliases: ['aj1 low', 'дж1 лоу', 'джордан 1 лоу'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 Mid', aliases: ['aj1 mid', 'дж1 мид'] },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 1 High', aliases: ['aj1 high', 'дж1 хай'], sku: 'DZ5485-612', colorway: 'Chicago «Lost & Found»', releaseYear: 1985, description: 'Первые именные кроссовки Майкла Джордана (1985) — модель, с которой началась сникер-культура. DZ5485-612 — переиздание «Chicago Lost & Found» 2022 года.' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 3', aliases: ['дж3'], sku: 'CT8532-106', releaseYear: 1988, description: 'Первый Jordan Тинкера Хэтфилда: видимая капсула Air и «слоновий» принт. Модель, удержавшая Джордана в Nike.' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 4', aliases: ['дж4', 'aj4'], sku: '840606-192', releaseYear: 1989, description: 'Силуэт Тинкера Хэтфилда с поддержкой-«крыльями» и сеткой — один из самых коллаборируемых Jordan.' },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 5', aliases: ['дж5'], releaseYear: 1990 },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 6', aliases: ['дж6'], releaseYear: 1991 },
  { brand: 'Jordan', category: 'footwear', name: 'Air Jordan 11', aliases: ['дж11'], sku: '378037-061', colorway: 'Black/Varsity Red «Bred»', releaseYear: 1995, description: 'Лакированная кожа и карбоновая пластина — самый «парадный» Jordan. «Bred» — чёрно-красная расцветка чемпионского сезона 1995/96.' },
  // adidas — обувь
  { brand: 'adidas', category: 'footwear', name: 'Samba', aliases: ['самба'], sku: 'B75806', colorway: 'Core Black/Cloud White', releaseYear: 1950, description: 'Старейший действующий силуэт adidas — футбольная модель 1950 года. В 2020-х снова стала самой востребованной моделью бренда.' },
  { brand: 'adidas', category: 'footwear', name: 'Gazelle', aliases: ['газель'], sku: 'BB5478', releaseYear: 1966, description: 'Замшевая тренировочная модель 1966 года; десятилетиями — униформа субкультур, от террас до бритпопа.' },
  { brand: 'adidas', category: 'footwear', name: 'Campus 00s', aliases: ['кампус'], sku: 'B22533', description: 'Переиздание баскетбольного Campus в пропорциях скейт-обуви нулевых: пухлый язык, широкие шнурки.' },
  { brand: 'adidas', category: 'footwear', name: 'Superstar', aliases: ['суперстар'], sku: 'C77124', colorway: 'Cloud White/Core Black', releaseYear: 1969, description: 'Баскетбольная модель 1969 года с «ракушечным» носом; Run-DMC сделали её первой сникер-иконой хип-хопа.' },
  { brand: 'adidas', category: 'footwear', name: 'Stan Smith', aliases: ['стэн смит'], sku: 'M20324', colorway: 'White/Green', description: 'Теннисная модель, названная в честь чемпиона Стэна Смита, — эталон минималистичного белого кеда.' },
  { brand: 'adidas', category: 'footwear', name: 'Forum Low', aliases: ['форум'], releaseYear: 1984 },
  { brand: 'adidas', category: 'footwear', name: 'Handball Spezial', aliases: ['хэндбол специал', 'hb spezial', 'спезиаль'], releaseYear: 1979, description: 'Гандбольная модель 1979 года: тонкая замша, подошва-гам. Возрождена на волне terrace-тренда.' },
  { brand: 'adidas', category: 'footwear', name: 'Ultraboost', aliases: ['ультрабуст'], releaseYear: 2015, description: 'Беговой флагман adidas с пеной Boost, продвинувший «энерговозврат» в массы.' },
  // Yeezy — обувь
  { brand: 'Yeezy', category: 'footwear', name: 'Boost 350 V2', aliases: ['350', 'изи 350'], sku: 'CP9654', colorway: 'Zebra', releaseYear: 2016, description: 'Главный силуэт линейки Канье Уэста и adidas: верх Primeknit, полноразмерный Boost. «Zebra» — одна из самых узнаваемых расцветок.' },
  { brand: 'Yeezy', category: 'footwear', name: 'Boost 700', aliases: ['700', 'изи 700'], sku: 'B75571', colorway: 'Wave Runner', releaseYear: 2017, description: 'Ретро-раннер, задавший моду на chunky-силуэты; Wave Runner — первая и главная расцветка.' },
  { brand: 'Yeezy', category: 'footwear', name: 'Slide', aliases: ['изи слайд', 'слайды'], releaseYear: 2019, description: 'Монолитные шлёпанцы из литой пены EVA — минимализм линейки Yeezy.' },
  { brand: 'Yeezy', category: 'footwear', name: 'Foam Runner', aliases: ['фоам', 'фоам раннер'], releaseYear: 2020, description: 'Цельнолитая модель-«клог» из пены с водорослями в составе, без шнурков и швов.' },
  // New Balance — обувь
  { brand: 'New Balance', category: 'footwear', name: '2002R', aliases: ['2002', 'm2002r'], sku: 'M2002RDA', colorway: 'Rain Cloud (Protection Pack)', description: 'Реинкарнация премиального раннера New Balance начала 2000-х. Protection Pack с «рваной» замшей — один из главных релизов 2021 года.' },
  { brand: 'New Balance', category: 'footwear', name: '1906R', aliases: ['1906', 'm1906r'] },
  { brand: 'New Balance', category: 'footwear', name: '1906D', aliases: ['m1906d'], sku: 'M1906D' },
  { brand: 'New Balance', category: 'footwear', name: '990', aliases: ['990v3', '990v4', '990v5', '990v6'], releaseYear: 1982, description: 'Первые кроссовки за 100 долларов (1982), Made in USA; серая замша 990-й серии — символ «тихой роскоши».' },
  { brand: 'New Balance', category: 'footwear', name: '9060', releaseYear: 2022, description: 'Современное прочтение 99X-серии: изогнутые панели и объёмная подошва.' },
  { brand: 'New Balance', category: 'footwear', name: '550', sku: 'BB550WT1', colorway: 'White/Green', releaseYear: 1989, description: 'Баскетбольная модель конца 80-х, возрождённая в 2020-м при участии Aimé Leon Dore.' },
  { brand: 'New Balance', category: 'footwear', name: '530' },
  { brand: 'New Balance', category: 'footwear', name: '327', releaseYear: 2020 },
  { brand: 'New Balance', category: 'footwear', name: '574', aliases: ['574'], releaseYear: 1988 },
  { brand: 'New Balance', category: 'footwear', name: '993', aliases: ['993'], releaseYear: 2008 },
  // Asics / Salomon / Puma / Reebok / Vans / Converse — обувь
  { brand: 'Asics', category: 'footwear', name: 'Gel-Kayano 14', aliases: ['каяно', 'kayano 14'], releaseYear: 2008, description: 'Беговой Gel-Kayano 2008 года, вернувшийся в моду на волне Y2K: серебристые панели, гель в подошве.' },
  { brand: 'Asics', category: 'footwear', name: 'Gel-1130' },
  { brand: 'Asics', category: 'footwear', name: 'Gel-NYC', releaseYear: 2023, description: 'Гибрид архивных беговых силуэтов Asics — современная городская модель.' },
  { brand: 'Asics', category: 'footwear', name: 'Gel-Lyte III', releaseYear: 1990, description: 'Классика 1990 года с фирменным раздвоенным языком.' },
  { brand: 'Salomon', category: 'footwear', name: 'XT-6', aliases: ['xt6'], releaseYear: 2013, description: 'Гоночная трейловая модель для ультрамарафонов, ставшая любимцем аутдор-моды: шнуровка Quicklace, подошва Contagrip.' },
  { brand: 'Salomon', category: 'footwear', name: 'XT-4' },
  { brand: 'Puma', category: 'footwear', name: 'Speedcat', aliases: ['спидкэт'], releaseYear: 1999, description: 'Гоночный силуэт Puma из паддоков Формулы-1 конца 90-х; вернулся на волне моды на плоские силуэты.' },
  { brand: 'Puma', category: 'footwear', name: 'Palermo' },
  { brand: 'Reebok', category: 'footwear', name: 'Club C 85', releaseYear: 1985 },
  { brand: 'Vans', category: 'footwear', name: 'Old Skool', aliases: ['олд скул'], sku: 'VN000D3HY28', colorway: 'Black/White', releaseYear: 1977, description: 'Скейт-классика 1977 года — первая модель Vans с боковой полосой jazz stripe.' },
  { brand: 'Vans', category: 'footwear', name: 'Knu Skool', aliases: ['кню скул'] },
  { brand: 'Converse', category: 'footwear', name: 'Chuck 70', aliases: ['чак 70'], sku: '162050C', colorway: 'Black', description: 'Премиальное переиздание Chuck Taylor All Star по лекалам 1970-х: плотный канвас, винтажный блеск резины.' },
  // UGG / Crocs — обувь
  { brand: 'UGG', category: 'footwear', name: 'Tazz', aliases: ['тазз'], releaseYear: 2022, description: 'Слипперы на платформе — уличная версия домашних UGG, тренд 2020-х.' },
  { brand: 'UGG', category: 'footwear', name: 'Classic Mini', aliases: ['классик мини'] },
  { brand: 'Crocs', category: 'footwear', name: 'Classic Clog', aliases: ['классик'], sku: '10001-001', colorway: 'Black', releaseYear: 2002, description: 'Литые сабо из фирменной пены Croslite; кастомизация джибитсами — часть культуры.' },
  // Travis Scott — коллабы
  { brand: 'Travis Scott', category: 'footwear', name: 'Air Jordan 1 Low TS', aliases: ['тревис джордан 1', 'ts aj1 low'], releaseYear: 2019, description: 'Коллаборация Трэвиса Скотта и Jordan Brand с перевёрнутым свушем — один из самых перепродаваемых силуэтов рынка.' },
  { brand: 'Travis Scott', category: 'apparel', name: 'Cactus Jack Hoodie', aliases: ['кактус джек худи'] },
  // Одежда
  { brand: 'Supreme', category: 'apparel', name: 'Box Logo Hoodie', aliases: ['бокс лого', 'bogo'], description: 'Худи с прямоугольным «box logo» — главный предмет Supreme; классические дропы моментально уходят в ресейл.' },
  { brand: 'Supreme', category: 'apparel', name: 'Box Logo Tee' },
  { brand: 'Stone Island', category: 'apparel', name: 'Sweatshirt' },
  { brand: 'Stone Island', category: 'apparel', name: 'Overshirt' },
  { brand: 'C.P. Company', category: 'apparel', name: 'Goggle Jacket', aliases: ['гогл'], releaseYear: 1988, description: 'Куртка Массимо Ости с линзами в капюшоне, созданная в 1988-м для гонки Mille Miglia. Икона итальянского милитари-дизайна.' },
  { brand: 'The North Face', category: 'apparel', name: 'Nuptse Jacket', aliases: ['нупсе', 'пуховик норт фейс'], releaseYear: 1992, description: 'Пуховик 1992 года с наполнителем 700 fill; возрождён в 2010-х как зимняя уличная классика.' },
  { brand: 'Stussy', category: 'apparel', name: 'Basic Logo Tee' },
  // Аксессуары — часы
  { brand: 'Audemars Piguet', category: 'watches', name: 'AP x Swatch', aliases: ['ап свотч', 'ap swatch'] },
  { brand: 'Audemars Piguet', category: 'watches', name: 'Royal Oak', aliases: ['роял оук'], sku: '15500ST.OO.1220ST.01', releaseYear: 1972, description: 'Дизайн Джеральда Дженты: восьмиугольный безель на видимых винтах, интегрированный браслет. Первые люксовые часы из стали (1972).' },
  { brand: 'Rolex', category: 'watches', name: 'Submariner', aliases: ['сабмаринер'], sku: '124060', releaseYear: 1953, description: 'Первый серийный дайвер с водозащитой 100 м (1953); ref. 124060 — современная 41-мм версия без даты.' },
  { brand: 'Rolex', category: 'watches', name: 'Daytona', aliases: ['дайтона'], sku: '116500LN', releaseYear: 1963, description: 'Хронограф для автогонок, названный в честь трассы Дайтона (1963); ref. 116500LN — версия с керамическим безелем.' },
  { brand: 'Casio', category: 'watches', name: 'G-Shock', aliases: ['джишок', 'gshock'], sku: 'DW5600E-1V', colorway: 'Black', releaseYear: 1983, description: 'Противоударные часы Кикуо Ибэ (1983); DW-5600 — базовый «квадрат», эталон серии.' },
  // Аксессуары — сумки
  { brand: 'Hermès', category: 'bags', name: 'Birkin', aliases: ['биркин'], releaseYear: 1984, description: 'Сумка 1984 года, придуманная после встречи главы Hermès с Джейн Биркин. Ручная сборка и листы ожидания сделали её самой дефицитной сумкой рынка.' },
  { brand: 'Hermès', category: 'bags', name: 'Kelly', aliases: ['келли'], description: 'Трапециевидная сумка Hermès 1930-х (Sac à dépêches), переименованная в честь Грейс Келли.' },
  { brand: 'Louis Vuitton', category: 'bags', name: 'Keepall', aliases: ['кипол'], releaseYear: 1930, description: 'Дорожная сумка Louis Vuitton, выпускается с 1930 года.' },
  { brand: 'Gucci', category: 'bags', name: 'GG Marmont', aliases: ['мармонт'], releaseYear: 2016 },
  { brand: 'Balenciaga', category: 'bags', name: 'Le Cagole', releaseYear: 2021 },
  { brand: 'Bottega Veneta', category: 'bags', name: 'Cassette', aliases: ['кассета'], releaseYear: 2019, description: 'Стёганая сумка из плетёной кожи intrecciato эпохи Даниэля Ли.' },
  { brand: 'Prada', category: 'bags', name: 'Re-Edition', aliases: ['ре-эдишн'], description: 'Переиздание нейлоновых мини-сумок Prada рубежа 2000-х.' },
  // Аксессуары — украшения
  { brand: 'Cartier', category: 'jewelry', name: 'Love Bracelet', aliases: ['лав браслет'], releaseYear: 1969, description: 'Браслет Альдо Чипулло, закрывающийся отвёрткой, — символ «запертой» любви и один из самых узнаваемых ювелирных дизайнов.' },
  { brand: 'Van Cleef & Arpels', category: 'jewelry', name: 'Alhambra', aliases: ['альгамбра', 'клевер'], releaseYear: 1968, description: 'Мотив четырёхлистного клевера Van Cleef & Arpels, выпускается с 1968 года.' },
  // Аксессуары — головные уборы
  { brand: 'New Era', category: 'headwear', name: '59FIFTY Cap', aliases: ['кепка', 'снепбек'], releaseYear: 1954, description: 'Классическая бейсболка с плоским козырьком — стандарт MLB с 1950-х.' },
  // Коллекционное
  { brand: 'Pop Mart', category: 'collectibles', name: 'Labubu The Monsters', aliases: ['лабубу', 'labubu'], releaseYear: 2015, description: 'Персонаж художника Касинга Лунга из серии The Monsters; фигурки и плюш Pop Mart — главный коллекционный хайп 2020-х.' },
  // Off-White
  { brand: 'Off-White', category: 'footwear', name: 'Out Of Office', aliases: ['ооо', 'out of office'], releaseYear: 2021 },
  { brand: 'Off-White', category: 'apparel', name: 'Arrows Hoodie', aliases: ['эрроус худи', 'стрелки худи'] },
  // A Bathing Ape (BAPE)
  { brand: 'A Bathing Ape', category: 'apparel', name: 'Shark Full Zip Hoodie', aliases: ['шарк худи', 'акула худи'], releaseYear: 2004, description: 'Худи с «акульей» мордой на капюшоне-молнии — визитная карточка A Bathing Ape.' },
  { brand: 'A Bathing Ape', category: 'footwear', name: 'Bapesta', aliases: ['бэйпста'], releaseYear: 2002, description: 'Ответ BAPE на Air Force 1: звезда STA вместо свуша, глянцевая кожа.' },
  // Palm Angels
  { brand: 'Palm Angels', category: 'apparel', name: 'Track Pants', aliases: ['палм трек'] },
  // Arc'teryx
  { brand: "Arc'teryx", category: 'apparel', name: 'Beta Jacket', aliases: ['бета джекет', 'арктерикс бета'], description: 'Мембранные куртки Gore-Tex линейки Beta — универсальная аутдор-классика.' },
  { brand: "Arc'teryx", category: 'apparel', name: 'Atom Hoody', aliases: ['атом худи'], description: 'Лёгкая утеплённая куртка на синтетике Coreloft — базовый мидлслой.' },
  // Moncler
  { brand: 'Moncler', category: 'apparel', name: 'Maya Jacket', aliases: ['майя', 'монклер майя'], description: 'Глянцевый лаковый пуховик — один из самых узнаваемых силуэтов Moncler.' },
  // Canada Goose
  { brand: 'Canada Goose', category: 'apparel', name: 'Expedition Parka', aliases: ['экспедишн', 'канада гус парка'], description: 'Парка, созданная в 1980-х для полярных станций Антарктиды.' },
  // Birkenstock
  { brand: 'Birkenstock', category: 'footwear', name: 'Boston', aliases: ['бостон'], description: 'Закрытый клог с пробковой анатомической стелькой.' },
  { brand: 'Birkenstock', category: 'footwear', name: 'Arizona', aliases: ['аризона'], releaseYear: 1973, description: 'Сандалии с двумя ремнями и пробковой стелькой-ложем, выпускаются с 1973 года.' },
  // Common Projects
  { brand: 'Common Projects', category: 'footwear', name: 'Achilles Low', aliases: ['ахиллес', 'ахилес'], releaseYear: 2004, description: 'Минималистичные кожаные кеды с золотым серийным номером на пятке — эталон «люксовой базы».' },
  // Timberland
  { brand: 'Timberland', category: 'footwear', name: '6 Inch Premium Boot', aliases: ['тимбы', 'тимберленды'], colorway: 'Wheat', releaseYear: 1973, description: 'Водонепроницаемый рабочий ботинок 1973 года; «пшеничный» нубук стал символом нью-йоркского хип-хопа.' },
  // Onitsuka Tiger
  { brand: 'Onitsuka Tiger', category: 'footwear', name: 'Mexico 66', aliases: ['мексико 66', 'онитсука мексико'], colorway: 'Yellow/Black', releaseYear: 1966, description: 'Силуэт, созданный к Олимпиаде-1968 в Мехико; жёлто-чёрная расцветка прославлена фильмом «Убить Билла».' },
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
      // Паспортные поля в update — только когда заданы в сиде: повторный прогон
      // не должен затирать данные, введённые админом вручную.
      update: {
        categoryId: catId[m.category],
        aliases: m.aliases ?? [],
        sku: m.sku ?? null,
        ...(m.colorway !== undefined ? { colorway: m.colorway } : {}),
        ...(m.releaseYear !== undefined ? { releaseYear: m.releaseYear } : {}),
        ...(m.description !== undefined ? { description: m.description } : {}),
      },
      create: {
        brandId: brandId[m.brand],
        categoryId: catId[m.category],
        name: m.name,
        aliases: m.aliases ?? [],
        sku: m.sku ?? null,
        colorway: m.colorway ?? null,
        releaseYear: m.releaseYear ?? null,
        description: m.description ?? null,
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
