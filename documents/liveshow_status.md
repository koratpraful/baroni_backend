### Live Show status & payment lifecycle – simple explanation

#### 1) `LiveShow.status`  (show ni high-level state)

- **`pending`**  
  - Show create thay gayu chhe.  
  - Cancel pan nathi thayu, complete pan nathi thayu.  
  - Upcoming / active booking ma aava shows use thay.

- **`completed`**  
  - Star / admin e `POST /live-shows/:id/complete-attendance` call kari didhu.  
  - Badha pending attendance transactions complete thai gaya, coins star taraf transfer thai gaya.

- **`cancelled`**  
  - Star / admin e `PATCH /live-shows/:id/cancel` kari show cancel kari didhu.  
  - Je je fans joined hata ane payment pending hata, e badha ni transactions cancel thai ne coins fans ne refund thai gaya.

---

#### 2) `LiveShow.paymentStatus`  (hosting payment – star → admin)

Aa **hosting payment** ni internal state che (live show create karta vakhte je transaction banay chhe).

- **`initiated`**  
  - Hybrid payment start thayu chhe (coins + OrangeMoney).  
  - External (OrangeMoney) side par user e payment complete nathi kari – link/gateway stage.

- **`pending`**  
  - Payment system ma properly reserve thai gayu chhe (coins / hybrid).  
  - Paisa “on hold” / escrow jeva state ma chhe.

- **`completed`**  
  - Je logic show complete thai pachi trigger thay chhe e run thay gayu.  
  - Admin taraf coins finally release / settle thai gaya.

- **`refunded`**  
  - Aa hosting payment upar refund flow run thayu chhe (error, cancel, etc.).  
  - Je amount hold ma hato e pachho mukli deyo chhe.

---

#### 3) `LiveShowAttendance.status`  (per-fan attendance record)

Aa ek fan na “join” record ni state che.

- **`pending`**  
  - Fan e show join kari didhu.  
  - Payment (coins / hybrid) reserve / initiate thai gayu chhe, pan final settle nathi thayu.  
  - Show joi shakshe, pan backend side e “completed accounting” baki chhe.

- **`completed`**  
  - Show complete thay pachi `completeLiveShowAttendance` run thayu.  
  - Aa fan ni attendance transaction complete thai gai, coins star ne transfer thai gaya.

- **`cancelled`**  
  - Show cancel thai gaya (star / admin dwara).  
  - Aa fan ni pending attendance cancel thai gai, ane coins paachha credit thai gaya (via `cancelTransaction`).

- **`refunded`**  
  - Koi dedicated refund flow run kariyo hoy (manual / special case) to attendance status `refunded` thai shake.  
  - Etle aa particular join mate pachho refund aapi deyo.

---

#### 4) `LiveShowAttendance.paymentStatus`  (payment ni fine-grain state)

- **`initiated`**  
  - Hybrid payment start thayu: OrangeMoney request bani gayu chhe, user ne payment karvu baki chhe.  
  - Transaction status typically `initiated`.

- **`pending`**  
  - Payment confirm thai ne system ma reserve chhe (coins / hybrid), pan final settlement baki chhe.  
  - Live show attendance still “pending completion”.

- **`completed`**  
  - `completeTransaction` safaltā thi call thayu.  
  - Coins star taraf transfer / escrow flow complete thai gayu (live show case ma direct star taraf).

- **`refunded`**  
  - `refundTransaction` run thayu chhe, aa attendance nu payment full refund thai gayu.

---

#### 5) `Transaction.status` (all flows ma common – appointment / dedication / live show)

Ek typical transaction life-cycle:

- **`initiated`**  
  - Hybrid flow start: external gateway (OrangeMoney) call thayu chhe.  
  - User tarafthi payment confirm thavu baki chhe.

- **`pending`**  
  - Payment side confirm, amount system ma lock / reserve chhe.  
  - Backend e aa amount ne hold ma rakhe chhe, final “business action” (appointment confirm, show complete, etc.) ni rah joi rahyu chhe.

- **`completed`**  
  - Final business action thai gai (appointment confirm, show complete, etc.).  
  - Amount receiver taraf credit thai gayu / escrow ma move thai gayu.

- **`cancelled`**  
  - Pending transaction cancel kari, coins payer taraf pachha credit kari didha.  
  - Koi final service deliver nathi kari.

- **`refunded`**  
  - Pehla complete thai gai transaction upar refund logic run thayu.  
  - Receiver tarafthi coins / balance pachha levā ane payer tarafthi “refund” kari de.