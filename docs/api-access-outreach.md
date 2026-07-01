# API / data-access outreach

Two short emails requesting programmatic access to data you already subscribe to.
Goal: personal-use API or data feed so pricing flows into Comicseller automatically.
Send from robert.a.agron@gmail.com. Fill the `[bracketed]` bits before sending.

---

## 1) CovrPrice

**To:** (use the contact/support address on covrprice.com — check the site footer or your
account page; if none, the site's contact form)
**Subject:** API / data-access for a personal comic-selling tool — existing Premium subscriber

Hi CovrPrice team,

I'm a Premium subscriber and a longtime user of your pricing data. I'm building a
small **personal** tool to help me price and list my own comic collection on eBay
more efficiently, and I'd love to pull CovrPrice values into it directly rather than
copying them by hand for thousands of books.

I know you power the CLZ Comics integration via an API, so I wanted to ask:

1. Do you offer API or data-feed access to individual Premium subscribers?
2. If so, what are the terms, rate limits, and pricing?
3. If not self-serve, is there a licensing path for personal (non-redistributed) use?

To be clear on scope: the data would only be used privately to price my own
listings — never redistributed, resold, or displayed publicly.

Happy to share more about the project or sign whatever terms are appropriate.
Thanks very much for the great product.

Best,
Rob Agron
[phone, optional]
CovrPrice account: [your account email / username]

---

## 2) Key Collector Comics

**To:** support@keycollectorcomics.com
**Subject:** Developer / data-access inquiry — paying subscriber building a personal tool

Hi Key Collector team,

I'm a paying subscriber and rely on your key-issue database and hot-keys data. I'm
building a **personal** tool to help me catalog and sell my own collection on eBay,
and I'd like to reference Key Collector's key-issue designations and values inside it
instead of looking each book up by hand.

Could you tell me:

1. Do you offer any API, export, or data-feed access for subscribers?
2. If so, what are the terms and pricing?
3. If there's no API, is a bulk export (e.g. CSV) of my tracked/collection data possible?

Scope: strictly personal use to price and identify my own books — no redistribution
or public display of your data.

Thanks for building such a useful resource — I appreciate any direction you can give.

Best,
Rob Agron
[phone, optional]
Key Collector account: [your account email]

---

## Notes / follow-up

- If either offers an API, we drop in an adapter behind the existing pricing
  provider layer (`PriceSource.COMIC_API`) and pricing becomes fully automatic —
  no rebuild needed.
- If they offer only CSV/export, the bulk importer already built (`POST /import/csv`)
  ingests it directly.
- Reasonable to wait ~1–2 weeks for a reply; ping once if you hear nothing.
- Keep it personal-use framed — it's the honest description and the easiest for them
  to say yes to.
