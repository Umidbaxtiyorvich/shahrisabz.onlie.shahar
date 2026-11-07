# Shahrisabz Online Shahar

Qashqadaryo viloyati, Shahrisabz shahrining 3D xaritasi (OpenStreetMap yo'llari, ko'cha va mahalla nomlari bilan). Binolar yo'q — faqat yo'llar. Instagram obunachilarining har biriga shahar chekkasida o'z linki bilan uy quriladi.

## Imkoniyatlar
- **Obunachi = uy**: yangi obunachi qo'shilganda shahar chekkasida avtomatik uy paydo bo'ladi (`@username` yorlig'i, bosilsa Instagram sahifasi ochiladi).
- **Kirish**: obunachi o'z username'i bilan kiradi, birinchi kirishda parol o'rnatadi.
- **Ko'chib o'tish**: xaritada istalgan ko'cha bo'yini bosib, o'z mahallasi/ko'chasiga ko'chadi.
- **Joy sotib olish**: ikki burchakni bosib maydon belgilanadi → narx = m² × narx. Nima qurishi (do'kon, kafe, uy…) va nomini yozadi → so'rov yuboriladi.
- **Admin panel** (`/admin`): "@user X joyni sotib olmoqchi" xabarlari, to'lov olingach **"To'landi — sotish"** bosiladi va bino xaritada nomi bilan quriladi. Obunachilarni qo'lda qo'shish, narxni o'zgartirish.
- O'z nikingni qidirish.
- **Chat**: uy ustidagi `@nik` ni bosganda o'sha uy egasi bilan chat ochiladi. Barcha xabarlar `data/db.json` da saqlanib qoladi; "💬 Xabarlar" tugmasida yozishmalar ro'yxati va o'qilmaganlar soni. Admin panelda barcha yozishmalar ko'rinadi.
- **Instagram ulash (admin panel)**: Instagram Business akkaunt ID va Meta Access Token kiritiladi → "Ulanishni tekshirish" (nik, obunachilar soni) → "Hozir sinxronlash". Har 10 daqiqada avtomatik sinxron: postlarga komment yozganlarga uy quriladi.

## Ishga tushirish
```bash
npm run osm     # (bir marta) Shahrisabz xaritasini public/osm.json ga yuklab oladi
npm start   # admin: login umid0229, parol umid0229
# o'zgartirish: ADMIN_LOGIN=... ADMIN_PASSWORD=... FOLLOW_SECRET=... npm start
```
Sayt: http://localhost:3000 · Admin: http://localhost:3000/admin
`osm.json` bo'lmasa, brauzer xaritani to'g'ridan-to'g'ri Overpass API'dan yuklaydi.

## Instagram obunani avtomatik ulash
Instagram rasmiy API'si "yangi obunachi" hodisasini bermaydi. Shuning uchun:
1. **ManyChat / Make / Zapier** kabi xizmatda "yangi obunachi" yoki "Direct'ga kalit so'z" triggeri qo'yib, quyidagini yuboring:
   `POST https://SAYT/api/follow` — body: `{"username":"nik","secret":"FOLLOW_SECRET"}`
2. Yoki Meta webhook'ni `https://SAYT/api/instagram/webhook` ga ulang (verify token = `FOLLOW_SECRET`) — komment/Direct yozgan foydalanuvchilarga uy quriladi.
3. Yoki admin paneldan usernamelarni ro'yxat qilib qo'shing.

Ma'lumotlar `data/db.json` da saqlanadi. Xarita © OpenStreetMap hissadorlari.
