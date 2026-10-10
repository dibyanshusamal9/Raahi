# Testing reference — inputs that produce correct output

The seed corpus covers **3 pilot districts**. Use these exact values; a
district or job outside this list is treated as "unknown" and the bot will ask
you to repeat (see the validation section at the bottom).

## Valid districts + their training centres

| District | State | Centres (all `active`) |
|----------|-------|------------------------|
| **Nalanda** | Bihar | PMKK Biharsharif, DDU-GKY Rajgir, NIELIT Bihta, WSC Bihar Sharif |
| **Bhagalpur** | Bihar | PMKK Bhagalpur, DDU-GKY Sultanganj, ITI Bhagalpur, Bunkar Kendra Bhagalpur |
| **Jhabua** | Madhya Pradesh | PMKK Jhabua, DDU-GKY Meghnagar, ITI Jhabua, KVK Jhabua (Agri) |

Every centre offers courses across most sectors, so any (district × interest)
below will return three real pathways with a named nearby centre.

## Interests that map to real courses

| Say this (any language) | Sector matched | Example top course |
|-------------------------|----------------|--------------------|
| tailoring / silai / सिलाई / तையல் | Apparel | Sewing Machine Operator |
| weaving / bunai / बुनाई / বুনন | Handloom | Handloom Weaver |
| mobile repair / मोबाइल रिपेयर | Telecom | Mobile Repair Technician |
| electrician / bijli / बिजली | Electronics | Domestic Electrician |
| beauty / parlour / ब्यूटी | Beauty & Wellness | Assistant Beauty Therapist |
| dairy / farming / खेती | Agriculture | Dairy Farmer |
| mason / mistri / राजमिस्त्री | Construction | Assistant Mason |
| retail / shop / दुकान | Retail | Retail Trainee Associate |
| flex / printing / banner | Printing | (needs scraped data — see note) |

## A full sample interview (English)

```
hi
yes
Radha                     ← name
Nalanda                   ← district (valid)
24                        ← age
10th                      ← education
tailoring                 ← interest  → Apparel
near home                 ← work preference
smartphone
own work
OBC                       ← category  → done, top-3 shown
```
Expected top-3: three Apparel courses (Sewing Machine Operator, Self-Employed
Tailor, Hand Embroiderer) with **DDU-GKY Rajgir / WSC Bihar Sharif ~5 km**.

## Hindi one-liner (multi-fact)

```
namaste mera naam Radha hai, main Nalanda se hun, 22 saal ki hun
haan
दसवीं
सिलाई
घर के पास
स्मार्टफोन
अपना काम
अनुसूचित जाति
```

## curl test (typed, no mic)

```bash
P=98$RANDOM
for t in hi yes Radha Nalanda 24 10th tailoring "near home" smartphone "own work" OBC; do
  curl -s -X POST localhost:8000/session/turn -H "content-type: application/json" \
    -d "{\"phone\":\"$P\",\"language\":\"en\",\"text\":\"$t\"}" | python -m json.tool | grep -E 'next_question|composer|qp_code'
done
```

## Wrong input — what the bot should say

| You give | Response |
|----------|----------|
| a district not in the 3 pilots (e.g. "Berlin") | "I couldn't find that district. Please tell me a district like Nalanda, Bhagalpur or Jhabua." |
| an age below 10 or above 80 | "Please tell me your age in years — for example, 24." |
| an unrecognised job | captured as free-text interest; if nothing matches, you still get the 3 best available with a note |
