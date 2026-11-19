import { MateriFokusMode, MateriTemplateStyle } from '../store/useStore';

export interface MateriTemplateOption {
  id: MateriTemplateStyle;
  number: number;
  name: string;
  subtitle: string;
  description: string;
}

export const MATERI_TEMPLATE_OPTIONS: MateriTemplateOption[] = [
  {
    id: 'educational_infographic',
    number: 1,
    name: 'Educational Infographic',
    subtitle: 'Materi lengkap',
    description: 'Poster visual lengkap mencakup pengantar, konsep inti, ilustrasi, aktivitas, rangkuman, dan latihan.',
  },
  {
    id: 'cheat_sheet',
    number: 2,
    name: 'Cheat Sheet',
    subtitle: 'Ringkasan materi',
    description: 'Lembar rujukan cepat padat inti sari, tabel fakta kunci, dan ringkasan siap ulang sebelum asesmen.',
  },
  {
    id: 'sticky_notes',
    number: 3,
    name: 'Sticky Notes',
    subtitle: 'Catatan penting',
    description: 'Kartu tempel berwarna cerah berisi catatan penting, pengingat adab, dan poin hafalan praktis.',
  },
  {
    id: 'mind_map',
    number: 4,
    name: 'Mind Map',
    subtitle: 'Pemetaan konsep',
    description: 'Peta pikiran bercabang dari gagasan utama ke sub-konsep agar siswa melihat hubungan materi secara utuh.',
  },
  {
    id: 'comic_strip',
    number: 5,
    name: 'Comic Strip',
    subtitle: 'Cerita pembelajaran',
    description: 'Panel komik naratif ramah anak dengan dialog keseharian siswa SD yang membumikan nilai PAIBP.',
  },
  {
    id: 'flashcard',
    number: 6,
    name: 'Flashcard',
    subtitle: 'Hafalan dan latihan',
    description: 'Kartu bolak-balik (Sisi Depan–Belakang) untuk menghafal huruf hijaiah, ayat, doa, Asmaulhusna, atau istilah.',
  },
  {
    id: 'step_by_step',
    number: 7,
    name: 'Step-by-Step',
    subtitle: 'Tahapan proses',
    description: 'Alur langkah berurutan bernomor jelas untuk praktik ibadah seperti bersuci, wudu, azan, salat, atau puasa.',
  },
  {
    id: 'timeline',
    number: 8,
    name: 'Timeline',
    subtitle: 'Kronologi sejarah',
    description: 'Garis waktu berurutan untuk memahami kisah keteladanan Nabi, Rasul, dan Khulafaurasyidin secara runtut.',
  },
  {
    id: 'comparison_chart',
    number: 9,
    name: 'Comparison Chart',
    subtitle: 'Perbandingan konsep',
    description: 'Bagan perbandingan dua konsep (misal halal vs haram, wajib vs sunah, atau akhlak terpuji vs tercela).',
  },
  {
    id: 'isometric_3d',
    number: 10,
    name: 'Isometric 3D',
    subtitle: 'Visualisasi objek',
    description: 'Visualisasi diagram objek nyata bernuansa perspektif 3D (masjid, Ka’bah, alam semesta, lingkungan, atau sarana ibadah).',
  },
];

export function getTemplateOption(style?: MateriTemplateStyle): MateriTemplateOption {
  return (
    MATERI_TEMPLATE_OPTIONS.find((t) => t.id === style) ||
    MATERI_TEMPLATE_OPTIONS[0]
  );
}

export interface TemplateRecommendation {
  primary: MateriTemplateStyle;
  alternatives: MateriTemplateStyle[];
  reason: string;
}

export function recommendMateriTemplates(
  fokus: MateriFokusMode,
  elemen: string,
  tpOrAtpText: string
): TemplateRecommendation {
  const el = (elemen || '').toLowerCase();
  const txt = (tpOrAtpText || '').toLowerCase();

  const isHistory =
    el.includes('sejarah') ||
    /nabi|rasul|khulafa|makkah|madinah|hijrah|kisah|keteladanan/.test(txt);

  const isPracticeSteps =
    /tata cara|bersuci|wudu|tayamum|salat|azan|ikamah|puasa|zakat|infak|sedekah|wakaf|praktik|gerakan/.test(
      txt
    );

  const isMemorization =
    /menghafal|membaca|hijaiah|harakat|bersambung|surah|al-fatihah|ayat|hadis|doa|zikir|asmaulhusna/.test(
      txt
    );

  const isComparison =
    /membedakan|halal|haram|wajib dan sunah|non-muslim|rukun iman|rukun islam|sifat|qada|taklif/.test(
      txt
    );

  const isConcreteObjectOrNature =
    /hewan|tumbuhan|alam|masjid|lingkungan|ciptaan|kitab|malaikat/.test(txt);

  if (fokus === 'atp') {
    // Fokus ATP = per pertemuan / spesifik operasional
    if (isHistory) {
      return {
        primary: 'timeline',
        alternatives: ['comic_strip', 'sticky_notes'],
        reason:
          'Fokus ATP sejarah/keteladanan paling efektif disajikan dengan Timeline kronologis agar alur peristiwa dalam satu pertemuan mudah diingat siswa.',
      };
    }
    if (isPracticeSteps) {
      return {
        primary: 'step_by_step',
        alternatives: ['flashcard', 'cheat_sheet'],
        reason:
          'Fokus ATP praktik ibadah membutuhkan urutan operasional yang jelas—gaya Step-by-Step memandu siswa tahap demi tahap.',
      };
    }
    if (isMemorization) {
      return {
        primary: 'flashcard',
        alternatives: ['sticky_notes', 'cheat_sheet'],
        reason:
          'Fokus ATP bacaan/hafalan sangat cocok memakai kartu Flashcard untuk melatih pelafalan Arab dan arti secara berulang.',
      };
    }
    if (isComparison) {
      return {
        primary: 'comparison_chart',
        alternatives: ['cheat_sheet', 'mind_map'],
        reason:
          'Fokus ATP yang membedakan dua konsep paling cepat dipahami siswa SD lewat tabel Comparison Chart berdampingan.',
      };
    }
    if (isConcreteObjectOrNature) {
      return {
        primary: 'isometric_3d',
        alternatives: ['comic_strip', 'sticky_notes'],
        reason:
          'Fokus ATP berbasis objek nyata atau lingkungan cocok memakai Isometric 3D agar siswa membayangkan bentuk dan fungsinya.',
      };
    }
    return {
      primary: 'cheat_sheet',
      alternatives: ['sticky_notes', 'comic_strip'],
      reason:
        'Untuk fokus ATP per pertemuan, Cheat Sheet merangkum inti materi secara padat, praktis, dan langsung siap dipelajari.',
    };
  }

  // Fokus TP = cakupan utuh & pemahaman konseptual menyeluruh
  if (isHistory) {
    return {
      primary: 'comic_strip',
      alternatives: ['timeline', 'educational_infographic'],
      reason:
        'Fokus TP kisah keteladanan cocok dengan Comic Strip cerita pembelajaran (tanpa visualisasi fisik Nabi/Rasul) atau Timeline utuh.',
    };
  }
  if (isPracticeSteps) {
    return {
      primary: 'step_by_step',
      alternatives: ['educational_infographic', 'isometric_3d'],
      reason:
        'Fokus TP ibadah/fikih membutuhkan Step-by-Step agar seluruh rangkaian syarat, rukun, dan praktik tergambar tuntas.',
    };
  }
  if (isComparison) {
    return {
      primary: 'comparison_chart',
      alternatives: ['mind_map', 'educational_infographic'],
      reason:
        'Fokus TP yang membandingkan konsep atau ketentuan hukum sangat efektif dipetakan melalui Comparison Chart & Mind Map.',
    };
  }
  if (isMemorization) {
    return {
      primary: 'mind_map',
      alternatives: ['flashcard', 'educational_infographic'],
      reason:
        'Fokus TP Al-Qur’an & Hadis memadukan pemahaman utuh (Mind Map) dan kartu latihan baca-hafal (Flashcard).',
    };
  }
  return {
    primary: 'educational_infographic',
    alternatives: ['mind_map', 'cheat_sheet'],
    reason:
      'Fokus TP mencakup konsep utuh dari CP—Educational Infographic menyajikan pengantar, konsep inti, contoh, aktivitas, dan latihan secara lengkap.',
  };
}
