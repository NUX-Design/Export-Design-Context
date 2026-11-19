# Repository Guidelines

## โครงสร้างโปรเจกต์

- `code.ts` เป็นโค้ดหลักของ Figma plugin: อ่าน selection, สำรวจ layers และรวบรวม variables, styles กับค่าดิบ
- `ui.html` รวมหน้าต่าง plugin, styles และสคริปต์สำหรับแสดงผลและดาวน์โหลดรายงาน
- `manifest.json` ระบุ metadata, entry point (`code.js`) และ `ui.html`
- `product-brief.md` บันทึกขอบเขตและพฤติกรรมที่คาดหวังของผลิตภัณฑ์

- `package.json` และ `tsconfig.json` กำหนด build ด้วย TypeScript (`tsc`) ส่วน `package-lock.json` ล็อกเวอร์ชัน dependencies

ยังไม่มีโฟลเดอร์ทดสอบใน repository นี้ ให้แก้ไฟล์ต้นทางที่เกี่ยวข้องโดยตรง และรักษา manifest ให้สอดคล้องกับไฟล์ที่ build ได้จริง ใน `manifest.json` ใช้เฉพาะ property ที่ Figma รองรับ (เช่น `isTool` ไม่รองรับและทำให้ import ไม่ผ่าน)

การสแกนอยู่ใน `code.ts` และสื่อสารกับ iframe ผ่าน `figma.ui.postMessage`; การแสดงผลและดาวน์โหลดอยู่ใน `ui.html` เมื่อเพิ่มข้อมูลในรายงาน ให้รักษาความแตกต่างระหว่าง variable binding, style และ raw value พร้อมเก็บ warnings สำหรับข้อมูลที่อ่านไม่ได้ หลีกเลี่ยงการอนุมาน token จากชื่อหรือค่าที่ดูคล้ายกัน

## Build, ทดสอบ และพัฒนา

ต้องมี Node.js และ npm ติดตั้งครั้งแรกด้วย `npm install` จากนั้นใช้คำสั่งเหล่านี้:

- `npm run build` แปลง `code.ts` เป็น `code.js` ที่ manifest อ้างถึง
- `npm run watch` แปลงใหม่อัตโนมัติเมื่อแก้ `code.ts`
- `npm run typecheck` ตรวจ type โดยไม่สร้างไฟล์

ยังไม่มี test runner จึงอย่าอ้างผลทดสอบอัตโนมัติ `npm run typecheck` ตรวจได้เฉพาะ type เท่านั้น ต้อง reload plugin ใน Figma (Plugins → Development → Import plugin from manifest) แล้วทดสอบด้วยมือเสมอ

ไฟล์ `code.js` เป็นผลลัพธ์จาก build ไม่ใช่ไฟล์ต้นทาง อย่าแก้ไฟล์นี้โดยตรง ให้แก้ `code.ts` แล้วรัน `npm run build` ใหม่ก่อน reload ทุกครั้ง ส่วน `ui.html` ไม่ต้อง build เพราะ `code.ts` อ้างถึงผ่าน `__html__` ซึ่ง Figma ฝังให้ตาม `manifest.json` ห้ามลบการอ้างอิงนี้

## รูปแบบโค้ดและการตั้งชื่อ

เขียน TypeScript โดยระบุชนิดข้อมูลสำหรับข้อมูลและข้อความที่ส่งระหว่าง plugin กับ UI ใช้ชื่อ `camelCase` สำหรับตัวแปรและฟังก์ชัน, `PascalCase` สำหรับ type และตัวอักษรใหญ่คั่นด้วยขีดล่างสำหรับค่าคงที่ ใช้ single quotes และรูปแบบ semicolonless ตามไฟล์ปัจจุบัน จัด HTML, CSS และ JavaScript ของ UI ไว้ใน `ui.html` จนกว่าจะมีการแยก build pipeline

## แนวทางทดสอบ

ทดสอบด้วย Figma โดยเลือก layer เดี่ยวและหลาย layer ทั้งแบบมีและไม่มี descendants จากนั้นตรวจสอบ selection, การสแกน layer ที่ซ่อนอยู่, warnings, Markdown preview และการดาวน์โหลด `.md` กับ `.json` ตรวจ JSON ที่มี variable binding, style และ raw value รวมถึงกรณีไม่มี selection และ metadata ที่เข้าถึงไม่ได้ หลังแก้ UI ให้ตรวจขนาดหน้าต่าง การเลื่อนเนื้อหา และข้อความสถานะ

## Commit และ Pull Request

ไม่มี Git history หรือ PR template ใน repository นี้ให้ตรวจพบ ใช้หัวข้อ commit สั้น ๆ ที่บอกการเปลี่ยนแปลง เช่น `Improve selection refresh` สำหรับ PR ให้อธิบายพฤติกรรมที่เปลี่ยน วิธีตรวจสอบ และแนบภาพหน้าจอเมื่อมีการเปลี่ยน UI ระบุข้อจำกัดหรือ metadata ที่ยังส่งออกไม่ได้ด้วย

## ความเป็นส่วนตัวและขอบเขต

Plugin นี้อ่านข้อมูลเพื่อสร้าง snapshot และควรคงการทำงานแบบ read-only รายงานอาจมีข้อความใน text layers ให้ตรวจเนื้อหาก่อนส่งต่อหรือแชร์ไฟล์ส่งออก
