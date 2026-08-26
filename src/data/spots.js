// Demo dataset. Places are real D.C. spots, verified against 2026 sources
// (venue sites, Washingtonian, PoPville, Axios DC — researched 2026-08-25);
// busyness numbers and every post are sample data seeded at load time.

export const CATEGORIES = {
  club: { id: 'club', label: 'Clubs', color: '#5C2B52', deep: '#4B2144', wash: '#5C2B52' },
  bar: { id: 'bar', label: 'Bars', color: '#8E4141', deep: '#6E3030', wash: '#8E4141' },
  music: { id: 'music', label: 'Live music', color: '#8A4A6B', deep: '#6E3853', wash: '#8A4A6B' },
  eats: { id: 'eats', label: 'Eats', color: '#C05B33', deep: '#9C4522', wash: '#C05B33' },
  study: { id: 'study', label: 'Coffee & study', color: '#B08430', deep: '#7D621E', wash: '#B08430' },
  outside: { id: 'outside', label: 'Outside', color: '#7C8A66', deep: '#57654A', wash: '#7C8A66' },
  culture: { id: 'culture', label: 'Culture', color: '#6B4A32', deep: '#523928', wash: '#6B4A32' },
  landmark: { id: 'landmark', label: 'Landmarks', color: '#5C5248', deep: '#443C33', wash: '#5C5248' },
  niche: { id: 'niche', label: 'One-offs', color: '#7E6A4F', deep: '#5F4E38', wash: '#7E6A4F' },
}

export const SPOTS = [
  // ---- night ----
  {
    id: 'admo', name: 'Adams Morgan', area: '18th Street', cat: 'bar', art: 'rowhouse',
    coords: [-77.0425, 38.9214], busy: 92,
    vibe: 'Eighteenth Street is one long porch party — every bar door open, everyone you know out on the sidewalk.',
    venues: ["Madam's Organ", 'Grand Duchess', "Perry's"],
  },
  {
    id: 'ustreet', name: 'U Street', area: 'U Street Corridor', cat: 'music', art: 'stage',
    coords: [-77.0287, 38.9171], busy: 88, labelUp: true,
    vibe: 'Show nights spill out of the 9:30 Club and end at a chili half-smoke. The block hums until late.',
    venues: ['9:30 Club', "Ben's Chili Bowl", 'El Rey (warm months)'],
  },
  {
    id: 'fourteenth', name: '14th & U', area: 'Logan Circle corridor', cat: 'bar', art: 'rooftop',
    coords: [-77.0318, 38.9135], busy: 90,
    vibe: 'A mile of packed patios and rooftops where the music scene melts into restaurant row. The Black Cat has anchored it since 1993.',
    venues: ['Black Cat', 'El Techo', 'Service Bar'],
  },
  {
    id: 'shaw', name: 'Shaw', area: 'Blagden Alley', cat: 'bar', art: 'beergarden',
    coords: [-77.023, 38.9092], busy: 61,
    vibe: 'Beer-garden tables and alley murals — loud enough to be fun, quiet enough to actually talk.',
    venues: ['Dacha Beer Garden', 'Calico', 'Blagden Alley'],
  },
  {
    id: 'hstreet', name: 'H Street', area: 'H Street NE', cat: 'bar', art: 'divebar',
    coords: [-76.9915, 38.9001], busy: 58,
    vibe: 'Dive bars, late ramen, and somebody always talking you into one more stop. Costume karaoke on Wednesdays.',
    venues: ["Little Miss Whiskey's", 'Maketto', 'Manny & Olga’s (til 5am)'],
  },
  {
    id: 'navyyard', name: 'Navy Yard', area: 'Capitol Riverfront', cat: 'bar', art: 'ballpark',
    coords: [-77.0074, 38.873], busy: 74,
    vibe: 'Game nights turn the whole riverfront into one crowd — the Bullpen pregame is free, then the walk along the water after.',
    venues: ['Nats Park', 'The Bullpen', 'Yards Park', 'Bluejacket'],
  },
  {
    id: 'colheights', name: 'Columbia Heights', area: '11th Street', cat: 'bar', art: 'trivia',
    coords: [-77.0272, 38.9295], busy: 52,
    vibe: 'Neighborhood bars where the trivia is competitive and the tab stays kind. Free comedy in the back room on Sundays.',
    venues: ['Wonderland Ballroom', 'The Coupe', '11th Street bars'],
  },
  {
    id: 'ivycity', name: 'Ivy City', area: 'Okie Street warehouses', cat: 'club', art: 'club',
    coords: [-76.9795, 38.9175], busy: 75,
    vibe: 'Warehouse-district big-night energy. Nobody wanders into Echostage — you plan the whole night around it.',
    venues: ['Echostage', 'Other Half Brewing', 'Gravitas rooftop'],
  },
  {
    id: 'flash', name: 'Flash', area: 'Florida Ave / Shaw', cat: 'club', art: 'club',
    coords: [-77.0206, 38.9157], busy: 64, minor: true,
    vibe: 'The serious dance room: two intimate floors, big-name DJs, and a rooftop to cool off between sets.',
    venues: ['Flash', 'Flash rooftop'],
  },
  {
    id: 'clubrow', name: 'Club Row', area: 'Connecticut Ave, below Dupont', cat: 'club', art: 'club',
    coords: [-77.042, 38.9062], busy: 70, minor: true,
    vibe: 'The dress-code strip: three-floor throwback nights at Decades and late rooms all within two blocks.',
    venues: ['Decades', 'Heist', 'Bravo Bravo'],
  },
  {
    id: 'lucy', name: 'Lucy Bar', area: 'Florida Ave & 14th', cat: 'club', art: 'divebar',
    coords: [-77.032, 38.9202], busy: 48, minor: true,
    vibe: 'A small dance bar with a big-room heart — the floor fills by eleven, no bottle service in sight.',
    venues: ['Lucy Bar', 'Taste of Lucy (Union Market)'],
  },
  {
    id: 'gallery', name: 'Gallery Place', area: 'Chinatown / the Arena', cat: 'bar', art: 'arena',
    coords: [-77.0219, 38.8981], busy: 78,
    vibe: 'Caps and Wizards nights pour twenty thousand people onto 7th Street, and the bars ride the wave until late.',
    venues: ['Capital One Arena', "Clyde's", 'Penn Social'],
  },
  {
    id: 'mtpleasant', name: 'Mt. Pleasant', area: 'Mt Pleasant Street', cat: 'bar', art: 'wine',
    coords: [-77.0378, 38.9312], busy: 60, labelUp: true,
    vibe: 'The anti-scene: one walkable strip of dives, natural wine, and pupusas — where you go when you don’t want a line.',
    venues: ['Marx Cafe', 'Bar del Monte', 'Purple Patch'],
  },
  {
    id: 'anacostia', name: 'Anacostia', area: 'MLK Ave & Good Hope Rd', cat: 'music', art: 'gogo',
    coords: [-76.994, 38.863], busy: 45,
    vibe: 'Go-go’s home base — the museum café has a recording studio and an outdoor stage, and Sandlot brings the block party.',
    venues: ['Go-Go Museum & Café', 'Sandlot Anacostia', 'Busboys and Poets'],
  },
  {
    id: 'riave', name: 'metrobar', area: 'Rhode Island Ave NE', cat: 'niche', art: 'divebar',
    coords: [-76.9995, 38.921], busy: 50, minor: true,
    vibe: 'A bar built around an actual decommissioned Metro car, next to a movie theater that serves dinner. No cover, full charm.',
    venues: ['metrobar', 'Alamo Drafthouse', 'City-State Brewing'],
  },
  {
    id: 'parkview', name: 'Park View', area: 'Georgia Avenue', cat: 'bar', art: 'beergarden',
    coords: [-77.0233, 38.9308], busy: 54, minor: true,
    vibe: 'Giant indoor-outdoor halls where the watch party is the main event — roomier and cheaper than 14th Street.',
    venues: ['Hook Hall', 'Midlands Beer Garden', 'Call Your Mother'],
  },
  {
    id: 'buzzard', name: 'Buzzard Point', area: 'Audi Field', cat: 'bar', art: 'arena',
    coords: [-77.0121, 38.8688], busy: 42, minor: true,
    vibe: 'On D.C. United match nights the whole Point turns into a scarf-wearing bar crawl. Supporter tickets run cheap.',
    venues: ['Audi Field', 'Dacha Navy Yard', 'The Point'],
  },
  // ---- study (deep dive 2026-08-25) ----
  {
    id: 'kogod', name: 'Kogod Courtyard', area: 'Portrait Gallery, 8th & G', cat: 'study', art: 'atrium',
    coords: [-77.0229, 38.898], busy: 55, labelUp: true,
    vibe: 'The wavy glass canopy between two Smithsonians — free wifi, marble planters, laptops welcome, open to 7pm every single day. Bring your own food.',
    venues: ['Portrait Gallery', 'American Art Museum', 'Courtyard Café'],
  },
  {
    id: 'loc', name: 'Library of Congress', area: 'Main Reading Room', cat: 'study', art: 'library',
    coords: [-77.0047, 38.8887], busy: 45,
    vibe: 'Study under the 160-foot dome of the most beautiful room in America — a free reader card, issued same-day with photo ID, is all it takes.',
    venues: ['Main Reading Room', 'Folger Shakespeare Library', 'Supreme Court steps'],
  },
  {
    id: 'tryst', name: 'Tryst', area: '18th Street, Adams Morgan', cat: 'study', art: 'coffee',
    coords: [-77.043, 38.9222], busy: 70, minor: true, labelUp: true,
    vibe: 'The original D.C. laptop coffeehouse — thrift-store couches, outlets everywhere, and a linger-all-day ethos since 1998. Bar after dark.',
    venues: ['Tryst', 'Lost City Books'],
  },
  {
    id: 'den', name: 'The Den', area: 'Politics & Prose, Chevy Chase', cat: 'study', art: 'books',
    coords: [-77.0698, 38.9546], busy: 45,
    vibe: 'A coffeehouse-and-wine-bar under D.C.’s most famous bookstore — study downstairs, then catch one of the near-nightly author talks upstairs.',
    venues: ['Politics & Prose', 'The Den', 'Comet Ping Pong'],
  },
  {
    id: 'eaton', name: 'Eaton DC', area: '12th & K, Downtown', cat: 'study', art: 'coffee',
    coords: [-77.0284, 38.9026], busy: 50, minor: true,
    vibe: 'An activist-art hotel whose library-lined lobby was built for laptops — an in-house radio station broadcasts from a glass booth while you work.',
    venues: ['Eaton House', 'Eaton Radio', 'Franklin Park'],
  },
  {
    id: 'bigbear', name: 'Big Bear Cafe', area: 'Bloomingdale', cat: 'study', art: 'coffee',
    coords: [-77.0122, 38.9128], busy: 45,
    vibe: 'The ivy-covered corner of Bloomingdale — exposed brick, a vine-draped patio, and the neighborhood’s whole laptop crowd. Farmers market Sundays.',
    venues: ['Big Bear Cafe', 'Bloomingdale Farmers Market', 'Crispus Attucks Park'],
  },
  {
    id: 'lacolombe', name: 'La Colombe', area: 'Blagden Alley', cat: 'study', art: 'coffee',
    coords: [-77.0243, 38.9063], busy: 60, minor: true,
    vibe: 'Draft lattes in a mural-covered carriage alley — the alley tables are surrounded by some of the most photographed street art in the city.',
    venues: ['La Colombe', 'Blagden Alley murals'],
  },
  {
    id: 'peregrine', name: 'Peregrine Espresso', area: 'Eastern Market', cat: 'study', art: 'coffee',
    coords: [-76.9986, 38.8853], busy: 50, minor: true,
    vibe: 'Capitol Hill’s serious-coffee institution since 2008 — grad students and Hill staffers hunched over laptops across from the market.',
    venues: ['Peregrine Espresso', 'Eastern Market'],
  },
  // ---- culture ----
  {
    id: 'ngaeast', name: 'National Gallery East', area: 'The Mall, 4th & Constitution', cat: 'culture', art: 'atrium',
    coords: [-77.0169, 38.8915], busy: 60,
    vibe: 'I.M. Pei’s angular wing of free modern art — and home of National Gallery Nights, the free after-hours parties with DJs and drinks. Enter the lottery.',
    venues: ['NGA East Building', 'NGA West', 'National Archives'],
  },
  {
    id: 'phillips', name: 'Phillips Collection', area: 'Dupont, 21st Street', cat: 'culture', art: 'atrium',
    coords: [-77.0468, 38.9115], busy: 55, minor: true,
    vibe: 'America’s first modern art museum, in a Dupont mansion — the Rothko Room, and Phillips after 5 on first Thursdays for about ten bucks as a student.',
    venues: ['The Phillips Collection', 'Rothko Room'],
  },
  {
    id: 'rubell', name: 'Rubell Museum', area: 'Southwest, 65 I St', cat: 'culture', art: 'library',
    coords: [-77.0104, 38.879], busy: 35,
    vibe: 'Major contemporary art — Kehinde Wiley, Keith Haring — in a converted historic Black public school. Free with any proof of D.C. residency.',
    venues: ['Rubell Museum DC', 'Culture House (nearby)'],
  },
  {
    id: 'suns', name: 'Suns Cinema', area: 'Mt Pleasant Street', cat: 'culture', art: 'film',
    coords: [-77.0374, 38.9305], busy: 60, minor: true,
    vibe: 'A tiny bar-cinema run by film obsessives — cult deep cuts and cocktails you carry to your seat. The last true arthouse in the District. Book ahead.',
    venues: ['Suns Cinema'],
  },
  {
    id: 'buildingmuseum', name: 'Building Museum', area: 'Judiciary Square', cat: 'culture', art: 'columns',
    coords: [-77.0176, 38.8977], busy: 40, minor: true,
    vibe: 'A Great Hall with 75-foot columns inside an 1887 landmark — entering is free, and locals quietly use the fountain-side tables as a spectacular work spot.',
    venues: ['National Building Museum', 'Great Hall café'],
  },
  {
    id: 'planetword', name: 'Planet Word', area: 'Franklin Park, 13th & K', cat: 'culture', art: 'books',
    coords: [-77.0295, 38.9023], busy: 45, minor: true, labelUp: true,
    vibe: 'A voice-activated museum of language — a talking word wall, a karaoke lab. Free entry, and first Wednesdays run pay-what-you-can evenings.',
    venues: ['Planet Word', 'Franklin Park'],
  },
  {
    id: 'chbooks', name: 'Capitol Hill Books', area: 'C Street, Eastern Market', cat: 'culture', art: 'books',
    coords: [-76.9963, 38.8848], busy: 45, minor: true, labelUp: true,
    vibe: 'Three floors of a rowhouse stuffed to the ceiling with used books — including the bathroom — plus hand-scrawled sarcastic signage. Wine night second Saturdays.',
    venues: ['Capitol Hill Books', 'East City Bookshop'],
  },
  {
    id: 'solidstate', name: 'Solid State Books', area: 'H Street NE', cat: 'culture', art: 'books',
    coords: [-76.999, 38.9001], busy: 40, minor: true,
    vibe: 'Black-owned bookstore-café anchoring H Street — the coffee bar pours beer and wine, and the shelves stay open until nine every night.',
    venues: ['Solid State Books', 'Atlas Performing Arts Center'],
  },
  // ---- more live music ----
  {
    id: 'bluesalley', name: 'Blues Alley', area: 'Georgetown, rear alley', cat: 'music', art: 'stage',
    coords: [-77.0627, 38.9043], busy: 65, minor: true,
    vibe: 'The nation’s oldest continuously running jazz supper club, hidden down a literal back alley since 1965 — Dizzy Gillespie played this room.',
    venues: ['Blues Alley', 'The Tombs'],
  },
  // ---- one-offs ----
  {
    id: 'dupontund', name: 'Dupont Underground', area: 'under Dupont Circle', cat: 'niche', art: 'tunnel',
    coords: [-77.0427, 38.9099], busy: 45, minor: true,
    vibe: 'An arts venue in the abandoned 1949 streetcar tunnels beneath the circle — raw concrete platforms hosting shows and screenings. D.C.’s best-kept secret.',
    venues: ['Dupont Underground'],
  },
  {
    id: 'omansion', name: 'O Museum', area: 'Mansion on O Street, Dupont', cat: 'niche', art: 'rowhouse',
    coords: [-77.0455, 38.9089], busy: 40, minor: true,
    vibe: 'Five rowhouses fused into a 100-room labyrinth with almost ninety secret doors — you tour it by hunting for hidden passages. Rosa Parks lived here.',
    venues: ['O Museum in the Mansion'],
  },
  {
    id: 'exorcist', name: 'Exorcist Steps', area: 'Prospect & 36th, Georgetown', cat: 'niche', art: 'steps',
    coords: [-77.0708, 38.9052], busy: 35,
    vibe: 'The 75-step stairway from The Exorcist, now an official D.C. landmark — students run repeats by day and dare each other here after dark.',
    venues: ['The Exorcist Steps', 'Key Bridge'],
  },
  {
    id: 'einstein', name: 'Einstein Memorial', area: 'Constitution Ave, by the Mall', cat: 'niche', art: 'monument',
    coords: [-77.0483, 38.8924], busy: 20, minor: true,
    vibe: 'The one memorial you’re encouraged to climb — sit in the seven-ton bronze lap, then stand at the center of the star map and hear your voice echo back.',
    venues: ['Albert Einstein Memorial', 'Constitution Gardens'],
  },
  {
    id: 'congressional', name: 'Congressional Cemetery', area: 'riverside Capitol Hill', cat: 'niche', art: 'monument',
    coords: [-76.9787, 38.8815], busy: 25,
    vibe: 'An 1807 cemetery that behaves like a park — yoga among the headstones, summer movie nights, and a goat herd every August. Sousa is buried here.',
    venues: ['Congressional Cemetery', 'Anacostia Riverwalk Trail'],
  },
  {
    id: 'byrdland', name: 'Byrdland Records', area: 'Union Market district', cat: 'niche', art: 'divebar',
    coords: [-76.997, 38.9078], busy: 35, minor: true, labelUp: true,
    vibe: 'Five thousand records and in-store shows next to the market — flip crates, catch a listening party, then eat your way through the hall.',
    venues: ['Byrdland Records', 'Songbyrd next door'],
  },
  // ---- outside (deep dive) ----
  {
    id: 'arboretum', name: 'National Arboretum', area: 'New York Ave NE', cat: 'outside', art: 'columns',
    coords: [-76.9695, 38.9106], busy: 30,
    vibe: 'Twenty-two Corinthian columns from the old Capitol standing alone in a meadow — the most surreal golden-hour spot in the city. Free, with free parking.',
    venues: ['Capitol Columns', 'Bonsai Museum'],
  },
  {
    id: 'kenilworth', name: 'Kenilworth Gardens', area: 'Anacostia Ave NE', cat: 'outside', art: 'river',
    coords: [-76.943, 38.9126], busy: 25,
    vibe: 'Ponds of pink lotus and water lilies with a boardwalk into the tidal marsh — free, and the lilies keep blooming into October.',
    venues: ['Aquatic Gardens', 'Riverwalk Trail'],
  },
  {
    id: 'rockcreek', name: 'Rock Creek Park', area: 'car-free Beach Drive', cat: 'outside', art: 'river',
    coords: [-77.0512, 38.9411], busy: 40,
    vibe: 'Miles of permanently car-free road through a forest canyon in the middle of the city — the run or ride that makes you forget you’re in one.',
    venues: ['Beach Drive', 'Peirce Mill', 'Nature Center'],
  },
  {
    id: 'roosevelt', name: 'Roosevelt Island', area: 'footbridge by Rosslyn', cat: 'outside', art: 'river',
    coords: [-77.0631, 38.8964], busy: 30, minor: true,
    vibe: 'A whole forested island in the Potomac with no cars or bikes allowed — cross the footbridge and the city noise just stops.',
    venues: ['Swamp boardwalk loop', 'Mount Vernon Trail'],
  },
  {
    id: 'hains', name: 'Hains Point', area: 'East Potomac Park', cat: 'outside', art: 'river',
    coords: [-77.0227, 38.8615], busy: 30,
    vibe: 'The flat four-mile loop at the rivers’ meeting point — the classic sunset ride, with planes dropping into National right across the channel.',
    venues: ['East Potomac Park', 'Tidal Basin'],
  },
  {
    id: 'dumbarton', name: 'Dumbarton Oaks', area: 'upper Georgetown', cat: 'outside', art: 'fountain',
    coords: [-77.0632, 38.9115], busy: 35, minor: true,
    vibe: 'Sixteen acres of terraced garden rooms hidden behind Georgetown brick walls — afternoons only, timed ticket bought online, nothing sold at the gate.',
    venues: ['Dumbarton Oaks Gardens', 'Montrose Park'],
  },
  {
    id: 'kingman', name: 'Kingman Island', area: 'the Anacostia, off Benning Rd', cat: 'outside', art: 'river',
    coords: [-76.9634, 38.8968], busy: 20, minor: true,
    vibe: 'Wild islands in the Anacostia laced with dirt trails — startlingly quiet, with Thursday-evening paddles and a bluegrass festival every May.',
    venues: ['Kingman & Heritage Islands', 'Riverwalk Trail'],
  },
  // ---- landmarks ----
  {
    id: 'unionstation', name: 'Union Station', area: 'Columbus Circle NE', cat: 'landmark', art: 'atrium',
    coords: [-77.0063, 38.8977], busy: 55,
    vibe: 'The gilded Beaux-Arts hall everyone rushes through and nobody looks up in — look up. Food hall below, trains to New York above.',
    venues: ['Main Hall', 'Union Station food hall', 'Columbus Circle'],
  },
  {
    id: 'carnegie', name: 'Carnegie Library', area: 'Mt Vernon Square', cat: 'landmark', art: 'library',
    coords: [-77.0229, 38.9026], busy: 45, minor: true, labelUp: true,
    vibe: 'D.C.’s 1903 marble library reborn as the world’s prettiest Apple Store — free to wander, with the DC History Center hiding upstairs.',
    venues: ['Apple Carnegie Library', 'DC History Center'],
  },
  {
    id: 'lincoln', name: 'Lincoln Memorial', area: 'west end of the Mall', cat: 'landmark', art: 'columns',
    coords: [-77.0502, 38.8893], busy: 60,
    vibe: 'Climb the steps at midnight — the memorial never closes, the crowds do. The reflecting pool does its best work after dark.',
    venues: ['Lincoln Memorial', 'Reflecting Pool', 'Einstein Memorial (nearby)'],
  },
  {
    id: 'tidalbasin', name: 'Tidal Basin', area: 'Jefferson & MLK memorials', cat: 'landmark', art: 'river',
    coords: [-77.0397, 38.8845], busy: 45, minor: true,
    vibe: 'Paddle boats under the Jefferson dome, MLK at sunset, and cherry-tree chaos every April. Off-season it’s yours.',
    venues: ['Paddle boats', 'MLK Memorial', 'Jefferson Memorial'],
  },
  {
    id: 'cathedral', name: 'National Cathedral', area: 'Wisconsin & Massachusetts', cat: 'landmark', art: 'cathedral',
    coords: [-77.0707, 38.9307], busy: 35,
    vibe: 'A full Gothic cathedral with a Darth Vader grotesque on the northwest tower — bring binoculars. The gardens below are a hidden study spot.',
    venues: ['Washington National Cathedral', 'Bishop’s Garden'],
  },
  {
    id: 'capitol', name: 'the Capitol', area: 'west lawn & Botanic Garden', cat: 'landmark', art: 'dome',
    coords: [-77.0107, 38.8899], busy: 50,
    vibe: 'The west lawn at dusk is the city’s best free amphitheater, and the Botanic Garden greenhouse next door is a jungle in winter.',
    venues: ['West Lawn', 'U.S. Botanic Garden', 'Capitol Visitor Center'],
  },
  // ---- more clubs & venues ----
  {
    id: 'dc9', name: 'DC9', area: '9th & U', cat: 'music', art: 'stage',
    coords: [-77.0238, 38.916], busy: 55, minor: true,
    vibe: 'Three floors: bar below, sweaty indie shows in the middle, rooftop on top. The room where you catch bands a year before they blow up.',
    venues: ['DC9 Nightclub', '9:30 Club (two blocks)'],
  },
  {
    id: 'park14', name: 'The Park', area: '14th & K, Downtown', cat: 'club', art: 'club',
    coords: [-77.0318, 38.9026], busy: 66, minor: true,
    vibe: 'Four floors of downtown dress-code energy — hip-hop and afrobeats, birthday dinners that become dance floors.',
    venues: ['The Park at Fourteenth'],
  },
  {
    id: 'ultrabar', name: 'Ultrabar', area: 'F Street, Penn Quarter', cat: 'club', art: 'club',
    coords: [-77.0243, 38.8975], busy: 62, minor: true,
    vibe: 'Five rooms on five floors in an old bank downtown — EDM up top, reggaeton below, lines around the block on Saturdays.',
    venues: ['Ultrabar', 'Decades (sister club)'],
  },
  // ---- late-night eats ----
  {
    id: 'latenight18', name: '18th St Late Night', area: 'Adams Morgan', cat: 'eats', art: 'diner',
    coords: [-77.0413, 38.921], busy: 65, minor: true,
    vibe: 'The 2am food row: a genuinely 24-hour diner and the dueling jumbo-slice windows — served on paper plates after ten, by neighborhood decree.',
    venues: ['The Diner (24h)', 'Jumbo Slice Pizza', 'Pizza Mart'],
  },
  {
    id: 'surfside', name: 'Surfside', area: '18th & N, Dupont', cat: 'eats', art: 'taco',
    coords: [-77.0417, 38.907], busy: 60, minor: true,
    vibe: 'The 24-hour taco window that has saved a generation of post-club stomachs — counter only, ten minutes, walk and eat.',
    venues: ['Surfside Taco Stand'],
  },
  // ---- eats ----
  {
    id: 'georgetown', name: 'Georgetown', area: 'M Street', cat: 'eats', art: 'bagel',
    coords: [-77.0622, 38.9053], busy: 55,
    vibe: 'Cobblestones, canal walks, and a bagel line that is somehow always worth it.',
    venues: ['Call Your Mother', 'Georgetown Cupcake', 'Falafel Inc.', 'The Tombs'],
  },
  {
    id: 'dupont', name: 'Dupont Circle', area: 'Connecticut Ave', cat: 'eats', art: 'books',
    coords: [-77.0434, 38.9097], busy: 48,
    vibe: 'The circle is the meeting point — books at Kramers, a burger at the just-reopened Duke’s, people-watching for free.',
    venues: ['Kramers', 'Duke’s Grocery', 'Un je ne sais quoi'],
  },
  {
    id: 'unionmarket', name: 'Union Market', area: 'NoMa / Ivy City edge', cat: 'eats', art: 'market',
    coords: [-76.9982, 38.9086], busy: 52,
    vibe: 'A food hall built for the indecisive — and since Songbyrd moved in around the corner, the night keeps going after dinner.',
    venues: ['Union Market Hall', 'Hi-Lawn rooftop', 'Songbyrd', 'La Cosecha'],
  },
  {
    id: 'barracks', name: 'Eastern Market', area: 'Barracks Row / 8th St SE', cat: 'eats', art: 'market',
    coords: [-76.9955, 38.8845], busy: 55,
    vibe: 'Weekend-market ritual, then cheap eats down 8th — and a walk-in jazz jam at Mr. Henry’s on Wednesdays.',
    venues: ['Eastern Market', 'The Roost', "Mr. Henry's"],
  },
  {
    id: 'petworth', name: 'Petworth', area: 'Upshur Row', cat: 'eats', art: 'taco',
    coords: [-77.0247, 38.942], busy: 48,
    vibe: 'Two blocks of chef-y cheap eats — wood-fired pies, porch-party energy, nobody dressed up.',
    venues: ['Timber Pizza Co.', 'Upshur Street strip'],
  },
  {
    id: 'farragut', name: 'The Square', area: 'Farragut / K Street', cat: 'eats', art: 'market',
    coords: [-77.0432, 38.9021], busy: 28, minor: true,
    vibe: 'The step-up food hall ten minutes from campus — chef stalls around an atrium bar. Closed Sundays.',
    venues: ['The Square', 'Atrium Bar', 'Farragut Square'],
  },
  // ---- coffee & study ----
  {
    id: 'tenleytown', name: 'Tenleytown', area: 'American University', cat: 'study', art: 'campus',
    coords: [-77.087, 38.938], busy: 18,
    vibe: 'Quiet upper-northwest energy — long tables, laptops, and nobody rushing you out.',
    venues: ['AU campus', 'Middle C Music', 'the Wawa study crowd'],
  },
  {
    id: 'foggybottom', name: 'Foggy Bottom', area: 'GW', cat: 'study', art: 'coffee',
    coords: [-77.0479, 38.8995], busy: 30, minor: true,
    vibe: 'Gelman all-nighters and a Tatte almond croissant as the reward for showing up.',
    venues: ['Gelman Library', 'Tatte', 'Western Market'],
  },
  {
    id: 'mlk', name: 'MLK Library', area: 'Downtown', cat: 'study', art: 'library',
    coords: [-77.0247, 38.8987], busy: 22, minor: true,
    vibe: 'The prettiest free study hall in the city — top floor, skylights, total calm.',
    venues: ['MLK Memorial Library', 'Capital One Café'],
  },
  {
    id: 'brookland', name: 'Brookland', area: 'Monroe Street Market', cat: 'study', art: 'campus',
    coords: [-76.9942, 38.9327], busy: 40,
    vibe: 'Catholic U’s front porch — the arts walk, long study tables, and open mics at Busboys.',
    venues: ['Busboys and Poets', 'Arts Walk', 'Monroe Street Market'],
  },
  // ---- outside ----
  {
    id: 'meridian', name: 'Meridian Hill', area: '16th Street', cat: 'outside', art: 'fountain',
    coords: [-77.0355, 38.9205], busy: 20, minor: true, labelUp: true,
    vibe: 'Cascading fountains and the Sunday drum circle — three o’clock until dark, like it has been for decades.',
    venues: ['Meridian Hill Park'],
  },
  {
    id: 'gtwaterfront', name: 'Georgetown Waterfront', area: 'Potomac', cat: 'outside', art: 'river',
    coords: [-77.0633, 38.902], busy: 40, minor: true,
    vibe: 'Golden hour on the steps, kayaks off Key Bridge Boathouse, and the bridge doing its postcard thing.',
    venues: ['Waterfront Park', 'Key Bridge Boathouse'],
  },
  {
    id: 'mall', name: 'National Mall', area: 'The Monuments', cat: 'outside', art: 'monument',
    coords: [-77.0353, 38.8895], busy: 35,
    vibe: 'The monuments at night are the best free date in America. Bring a speaker, keep it low.',
    venues: ['Lincoln steps', 'Tidal Basin', 'Sculpture Garden'],
  },
  {
    id: 'wharf', name: 'The Wharf', area: 'Southwest Waterfront', cat: 'outside', art: 'pier',
    coords: [-77.0233, 38.8785], busy: 66,
    vibe: 'Fire pits on the pier, free Friday sets on Transit Pier all summer, swings facing the water.',
    venues: ['District Pier', 'The Anthem', 'Pearl Street Warehouse', 'Union Stage'],
  },
  {
    id: 'noma', name: 'NoMa', area: 'Alethia Tanner Park', cat: 'outside', art: 'beergarden',
    coords: [-77.0064, 38.904], busy: 50, minor: true,
    vibe: 'A year-round beer garden with fire pits, and free movies on the park lawn when it’s warm.',
    venues: ['Wunder Garten', 'Alethia Tanner Park', 'Metropolitan Branch Trail'],
  },
]

const min = 60 * 1000
const todayAt = (now, h, m = 0) => {
  const d = new Date(now)
  d.setHours(h, m, 0, 0) // hours >= 24 roll into tomorrow
  return d.getTime()
}
// approximate D.C. sunset by month, in fractional hours
const SUNSET = [17.0, 17.6, 19.2, 19.7, 20.2, 20.6, 20.6, 20.0, 19.2, 18.4, 17.0, 16.8]

// The demo feed follows the city's real weekly rhythm (recurring items
// verified Aug 2026): day = null runs daily, a number is getDay() (0 = Sun),
// an array matches several days. month (0-11) gates seasonal items.
// end: fractional hour today (may exceed 24), or 'sunset+H'.
const CALENDAR = [
  { id: 'e1', spotId: 'ustreet', day: null, end: 23, photo: 'stage', title: 'Show tonight at the 9:30 Club — doors at 7' },
  { id: 'e2', spotId: 'admo', day: null, end: 26, photo: 'rowhouse', title: 'Live blues at Madam’s Organ — every night, tonight included' },
  { id: 'e3', spotId: 'latenight18', day: null, end: 28, title: 'The diner never closes — jumbo slices on paper plates til 4' },
  { id: 'e4', spotId: 'mall', day: null, end: 'sunset+0.5', title: 'Sunset yoga by the monuments — mats out on the Lincoln lawn' },
  { id: 'e5', spotId: 'kogod', day: null, end: 19, title: 'Canopy’s quiet — open tables under the glass til 7' },
  { id: 'e6', spotId: 'lincoln', day: null, end: 'sunset+2', title: 'Steps are lit and nearly empty — best hour on the marble' },
  { id: 'e7', spotId: 'unionmarket', day: null, end: 23.5, title: 'Small room, big sound — show at Songbyrd tonight' },
  { id: 'e8', spotId: 'gallery', day: null, end: 23, title: 'Arena letting out — 7th Street bars filling up' },
  { id: 'e9', spotId: 'meridian', day: 0, end: 'sunset+0', title: 'Drum circle going til dark — like every Sunday since the 60s' },
  { id: 'e10', spotId: 'admo', day: 0, end: 15, title: 'Drag brunch at Perry’s — two seatings, come hungry' },
  { id: 'e11', spotId: 'barracks', day: [0, 6], end: 16, title: 'Market sprawl — flea + farmers vendors til 4' },
  { id: 'e12', spotId: 'navyyard', day: 1, end: 22, title: 'Free trivia at Dacha — prizes, 7 sharp' },
  { id: 'e13', spotId: 'colheights', day: 1, end: 22.5, title: 'Quiz night at Wonderland — 7:30 in the back room' },
  { id: 'e14', spotId: 'fourteenth', day: 2, end: 22, title: 'Open-mic poetry at Busboys — sign-up at 8' },
  { id: 'e15', spotId: 'barracks', day: 3, end: 23, title: 'Walk-in jazz jam at Mr. Henry’s — sign up and play' },
  { id: 'e16', spotId: 'hstreet', day: 3, end: 26, title: 'Kostume Karaoke at Little Miss Whiskey’s — wigs provided' },
  { id: 'e17', spotId: 'wharf', day: 4, end: 21, title: 'Grooves in the Grove — free funk on the lawn' },
  { id: 'e18', spotId: 'wharf', day: 5, end: 21.5, title: 'Rock the Dock — free show on Transit Pier at 7' },
  { id: 'e19', spotId: 'colheights', day: 0, end: 23, title: 'Free comedy in Wonderland’s back room at 8' },
  { id: 'e20', spotId: 'congressional', day: null, month: 7, end: 17, title: 'The goats are back — thirty of them, on landscaping duty' },
  { id: 'e21', spotId: 'flash', day: [4, 5, 6], end: 27, title: 'House set downstairs — doors at 10' },
  { id: 'e22', spotId: 'clubrow', day: [5, 6], end: 26.5, title: 'Throwback floors open — the line moves fast before 11' },
]

export function seedEvents(now) {
  const d = new Date(now)
  const day = d.getDay()
  const month = d.getMonth()
  const sunsetH = SUNSET[month]
  const out = []
  for (const ev of CALENDAR) {
    if (ev.day !== null && ev.day !== undefined) {
      const days = Array.isArray(ev.day) ? ev.day : [ev.day]
      if (!days.includes(day)) continue
    }
    if (ev.month !== undefined && ev.month !== month) continue
    let endsAt
    if (typeof ev.end === 'string' && ev.end.startsWith('sunset')) {
      const plus = parseFloat(ev.end.slice(7) || '0') || 0
      const h = sunsetH + plus
      endsAt = todayAt(now, Math.floor(h), Math.round((h % 1) * 60))
    } else {
      endsAt = todayAt(now, Math.floor(ev.end), Math.round((ev.end % 1) * 60))
    }
    // only what's still ahead, and near enough to feel like tonight
    if (endsAt <= now || endsAt - now > 12 * 60 * 60000) continue
    out.push({ id: ev.id, spotId: ev.spotId, title: ev.title, endsAt, photo: ev.photo || null })
  }
  // one fast-expiring post so the disappearing mechanic shows itself
  out.push({ id: 'x1', spotId: 'gtwaterfront', title: 'Golden hour on the steps right now', endsAt: now + 2 * min, photo: null })
  return out
}

export function crowdWord(busy) {
  if (busy >= 80) return 'Packed'
  if (busy >= 60) return 'Buzzing'
  if (busy >= 40) return 'Steady'
  return 'Quiet'
}
