# Instagram carousels (1080x1350) in the Mayo's brand: cream / navy / ranch red,
# Anton titles, Montserrat body. Writes one HTML page per slide; render.js screenshots them.
import html
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "..", "AI Video Editor", "Signature Style", "fonts", "viral")
MASCOT = os.path.join(HERE, "..", "brand", "refresh", "svg", "mascot-red.svg")
RED, CREAM, NAVY = "#C4553B", "#F3EBDD", "#1E2A3A"
HANDLE = "@its_mayos_construction"

CSS = f"""
@font-face{{font-family:Anton;src:url("file://{FONTS}/Anton-Regular.ttf")}}
@font-face{{font-family:Montserrat;src:url("file://{FONTS}/Montserrat-Bold.ttf");font-weight:700}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1350px;overflow:hidden}}
body{{background:{CREAM};color:{NAVY};font-family:Montserrat,sans-serif;position:relative}}
.pad{{position:absolute;inset:90px 90px 150px}}
.kicker{{font:700 30px Montserrat;letter-spacing:.16em;text-transform:uppercase;color:{RED}}}
h1{{font:400 128px/1.0 Anton,sans-serif;text-transform:uppercase;letter-spacing:.005em}}
h2{{font:400 104px/1.02 Anton,sans-serif;text-transform:uppercase}}
p{{font:700 46px/1.38 Montserrat;margin-top:40px}}
.big{{font:400 280px/0.85 Anton;color:{RED}}}
.red{{color:{RED}}}
.foot{{position:absolute;left:90px;right:90px;bottom:60px;display:flex;justify-content:space-between;align-items:center;
  font:700 26px Montserrat;color:{NAVY};opacity:.75;border-top:3px solid {NAVY};padding-top:22px}}
.foot img{{height:58px;margin-right:14px;vertical-align:middle}}
.swipe{{color:{RED};opacity:1}}
.photo{{position:absolute;inset:0;background-size:cover;background-position:center}}
.shade{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,42,58,.15) 0%,rgba(30,42,58,.25) 40%,rgba(30,42,58,.92) 100%)}}
.dark{{color:#fff}} .dark .foot{{color:#fff;border-color:#fff;opacity:.9}}
.tag{{display:inline-block;background:{RED};color:{CREAM};font:400 44px Anton;padding:8px 22px 10px;border-radius:10px;text-transform:uppercase}}
.box{{background:{NAVY};color:{CREAM};border-radius:22px;padding:44px 50px;margin-top:44px}}
.box p{{margin-top:0}}
ul{{list-style:none;margin-top:34px}}
li{{font:700 46px/1.35 Montserrat;padding-left:62px;position:relative;margin-top:22px}}
li:before{{content:"";position:absolute;left:0;top:10px;width:38px;height:38px;border:5px solid {RED};border-radius:8px}}
li.x:after{{content:"";position:absolute;left:9px;top:2px;width:14px;height:30px;border:solid {RED};border-width:0 7px 7px 0;transform:rotate(40deg)}}
"""


def foot(n, total, dark=False):
    swipe = '<span class="swipe">swipe →</span>' if n < total else '<span class="swipe">save this ↓</span>'
    return (f'<div class="foot"><span><img src="file://{MASCOT}">{HANDLE}</span>'
            f'<span>{n}/{total}</span>{swipe}</div>')


def page(body, dark=False):
    return (f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head>'
            f'<body class="{"dark" if dark else ""}">{body}</body></html>')


def photo_cover(img, kicker, title, sub, n, total):
    return page(f'<div class="photo" style="background-image:url(file://{HERE}/photos/{img})"></div><div class="shade"></div>'
                f'<div class="pad" style="top:auto;bottom:170px"><div class="kicker" style="color:{CREAM}">{kicker}</div>'
                f'<h1 style="margin-top:18px">{title}</h1><p style="margin-top:22px">{sub}</p></div>{foot(n, total, True)}', dark=True)


def text_slide(kicker, title, body, n, total, number=None):
    num = f'<div class="big">{number}</div>' if number else ""
    return page(f'<div class="pad" style="display:flex;flex-direction:column;justify-content:center">{num}<div class="kicker" style="margin-top:{20 if number else 0}px">{kicker}</div>'
                f'<h2 style="margin-top:18px">{title}</h2>{body}</div>{foot(n, total)}')


CAROUSELS = {}

# 1. Stay booked (contractor audience; repurposes the reel).
T = 6
CAROUSELS["stay-booked"] = [
    photo_cover("deck.jpg", "For contractors", 'How I’d stay <span class="red">booked</span>',
                "If I lost every customer tomorrow, this is where my next jobs would come from.", 1, T),
    text_slide("The problem", 'Slammed one week.<br><span class="red">Dead</span> the next.',
               "<p>You finish a job Friday, and Monday there’s nothing on the calendar. That’s not a slow season. That’s a missing system.</p>", 2, T),
    text_slide("Your free Google profile", "Post every job.<br>Ask before you leave.",
               "<ul><li class='x'>Post photos of every job with the town name: “deck repair, Hot Springs”</li>"
               "<li class='x'>Ask for the review while they’re standing in the finished room</li>"
               "<li class='x'>Text them the link right there</li></ul>", 3, T, "1"),
    text_slide("Realtors + property managers", "Be the guy who <span class='red'>shows up</span>.",
               "<p>Almost every home sale has an inspection list. Every rental turnover needs it fixed yesterday.</p>"
               "<div class='box'><p>Answer the phone. Show up in two days. That’s the whole pitch.</p></div>", 4, T, "2"),
    text_slide("The one nobody does", "Write down the <span class='red'>next</span> job.",
               "<ul><li class='x'>Soft rot by the back door</li><li class='x'>Deck needs stain next spring</li>"
               "<li class='x'>Old water heater in the garage</li></ul>"
               "<p>Slow week coming? Text those people first.</p>", 5, T, "3"),
    text_slide("The takeaway", 'Your next job is in the houses you <span class="red">already</span> worked on.',
               f"<p>Save this for your next slow week.</p><p style='margin-top:20px'>What’s kept <span class='red'>you</span> booked? Tell me in the comments.</p>", 6, T),
]

# 2. Homeowner questions (customer audience).
T = 7
CAROUSELS["hire-a-contractor"] = [
    photo_cover("counter.jpg", "For homeowners", 'Ask these <span class="red">5</span> before you hire a contractor',
                "From a father &amp; son crew in Hot Springs who’d want you to ask us too.", 1, T),
    text_slide("Question", "“Are you licensed and insured?”",
               "<p>Ask to see it. A real contractor won’t mind. If something goes wrong on your property, insurance is what protects you.</p>", 2, T, "1"),
    text_slide("Question", "“Can I get that in writing?”",
               "<p>The scope, the price, and what’s <span class='red'>not</span> included. If it isn’t written down, it isn’t in the estimate.</p>", 3, T, "2"),
    text_slide("Question", "“How do payments work?”",
               "<p>A deposit to start is normal. Paying the whole job up front isn’t. Payments should line up with work you can see.</p>", 4, T, "3"),
    text_slide("Question", "“Who’s actually doing the work?”",
               "<p>The person who gives you the estimate isn’t always the person who shows up. Ask who’ll be in your house.</p>", 5, T, "4"),
    text_slide("Question", "“What happens if you find something?”",
               "<p>Rot behind the drywall. Wiring that isn’t up to code. Ask how surprises get priced <span class='red'>before</span> they happen.</p>", 6, T, "5"),
    text_slide("Mayo’s Construction", "Free estimates. Father &amp; son.",
               "<p>Repairs, remodels, decks and flooring in Hot Springs, AR. When you call, you get one of us.</p>"
               "<div class='box'><p>Call or text<br><span style=\"font:400 84px Anton;letter-spacing:.02em\">870-617-3507</span></p></div>", 7, T),
]

# 3. Humor list with real job photos.
T = 6
FUN = [("bats.jpg", "Bats.", "There was not “a bat.”"),
       ("breaker.jpg", "An unlabeled breaker panel.", "It’s always the last one."),
       ("vent.jpg", "A vent cover that fights back.", "Five minutes, they said."),
       ("plugs.jpg", "“Just one more board.”", "It was not one more board.")]
CAROUSELS["not-on-the-estimate"] = [
    page(f'<div class="pad" style="display:flex;flex-direction:column;justify-content:center">'
         f'<div class="kicker">Contractor life</div><h1 style="margin-top:22px">Things that weren’t on the <span class="red">estimate</span></h1>'
         f'<p>A list. Swipe if you’ve been there.</p></div>{foot(1, T)}'),
] + [
    page(f'<div class="photo" style="background-image:url(file://{HERE}/photos/{img})"></div><div class="shade"></div>'
         f'<div class="pad" style="top:auto;bottom:170px"><span class="tag">Not on the estimate</span>'
         f'<h2 style="margin-top:26px">{title}</h2><p style="margin-top:16px">{sub}</p></div>{foot(i + 2, T, True)}', dark=True)
    for i, (img, title, sub) in enumerate(FUN)
] + [
    text_slide("Your turn", "What wasn’t on <span class='red'>yours</span>?",
               "<p>Tell me in the comments. Best one gets its own video.</p>", T, T),
]

for name, slides in CAROUSELS.items():
    d = os.path.join(HERE, name)
    os.makedirs(d, exist_ok=True)
    for i, s in enumerate(slides, 1):
        open(os.path.join(d, f"slide-{i:02d}.html"), "w").write(s)
print("ok", {k: len(v) for k, v in CAROUSELS.items()})
