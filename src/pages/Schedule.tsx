import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { Save, FileText, Clock } from 'lucide-react';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const GRADES = [1, 2, 3, 4, 5, 6];

interface ScheduleItem {
  day: string;
  jp: number;
  jamKe?: string;
}

export default function Schedule() {
  const { user, profile, schedules: storeSchedules, setSchedules: setStoreSchedules } = useStore();
  const [schedules, setSchedules] = useState<Record<number, ScheduleItem>>({
    1: { day: 'Senin', jp: 3, jamKe: '3, 4, 5' },
    2: { day: 'Selasa', jp: 3, jamKe: '2, 3, 4' },
    3: { day: 'Rabu', jp: 3, jamKe: '2, 3, 4' },
    4: { day: 'Jumat', jp: 3, jamKe: '4, 5, 6' },
    5: { day: 'Kamis', jp: 3, jamKe: '2, 3, 4' },
    6: { day: 'Kamis', jp: 3, jamKe: '6, 7, 8' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Export options state
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageSize, setPageSize] = useState<'A4' | 'F4'>('A4');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      if (!user) return;
      if (Object.keys(storeSchedules).length > 0) {
        setSchedules(storeSchedules);
      }
      setLoading(false);
    };
    fetchSchedules();
  }, [user, storeSchedules]);

  const handleChange = (grade: number, field: keyof ScheduleItem, value: string | number) => {
    setSchedules(prev => ({
      ...prev,
      [grade]: {
        ...prev[grade],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      setStoreSchedules(schedules);
      alert('Jadwal berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan jadwal.');
    }
    setSaving(false);
  };

  const handleDownloadWord = () => {
    const totalJpAllCalc = (Object.values(schedules) as ScheduleItem[]).reduce((acc, curr) => acc + (curr.jp || 0), 0);
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Jadwal Mengajar PAI</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            color: #1e293b;
            line-height: 1.6;
            margin: 30px;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #065f46;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .header h3 {
            font-size: 11pt;
            text-transform: uppercase;
            margin: 0;
            color: #475569;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .header h1 {
            font-size: 16pt;
            text-transform: uppercase;
            margin: 6px 0;
            color: #065f46;
            font-weight: bold;
          }
          .header p {
            font-size: 10pt;
            color: #64748b;
            margin: 3px 0;
          }
          .badge {
            display: inline-block;
            background-color: #ecfdf5;
            color: #065f46;
            padding: 6px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 10pt;
            margin-top: 12px;
            border: 1px solid #a7f3d0;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 25px;
            font-size: 11pt;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-collapse: collapse;
          }
          .meta-table td {
            padding: 12px 18px;
            vertical-align: top;
          }
          .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            font-size: 11pt;
          }
          .schedule-table th {
            background-color: #065f46;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 12px 14px;
            border: 1px solid #047857;
          }
          .schedule-table td {
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
          }
          .schedule-table tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .note-box {
            background-color: #fffbeb;
            border: 1px solid #fde68a;
            padding: 14px 18px;
            margin-bottom: 35px;
            font-size: 10.5pt;
            color: #78350f;
            font-weight: 600;
            line-height: 1.5;
          }
          .signatures {
            width: 100%;
            margin-top: 50px;
            font-size: 11pt;
          }
          .signature-space {
            height: 75px;
          }
          .underline-name {
            font-weight: bold;
            text-decoration: underline;
            color: #0f172a;
            font-size: 12pt;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>Pemerintah Kabupaten / Kementerian Agama</h3>
          <h1>${profile?.namaSekolah || 'SD NEGERI CONTOH'}</h1>
          <p>NPSN: ${profile?.npsn || '12345678'} &mdash; Tahun Pelajaran: ${profile?.tahunPelajaran || '2026/2027'}</p>
          <div class="badge">JADWAL MENGAJAR GURU PENDIDIKAN AGAMA ISLAM (PAI)</div>
        </div>

        <table class="meta-table">
          <tr>
            <td width="50%">
              <strong>Nama Guru:</strong> ${profile?.namaGuru || 'Nama Guru, S.Pd.I'}<br/>
              <strong>NIP / NUPTK:</strong> ${profile?.nip || '-'}
            </td>
            <td width="50%">
              <strong>Mata Pelajaran:</strong> Pendidikan Agama Islam dan Budi Pekerti<br/>
              <strong>Total Beban JP:</strong> ${totalJpAllCalc} JP / Minggu
            </td>
          </tr>
        </table>

        <table class="schedule-table">
          <thead>
            <tr>
              <th style="text-align: center; width: 50px;">No</th>
              <th>Kelas</th>
              <th>Hari Mengajar</th>
              <th style="text-align: center;">Jam Ke-</th>
              <th style="text-align: center;">Beban JP</th>
              <th style="text-align: center;">Durasi / Waktu</th>
            </tr>
          </thead>
          <tbody>
            ${GRADES.map((grade, idx) => {
              const item = schedules[grade] || { day: '-', jp: 0, jamKe: '-' };
              return `
                <tr>
                  <td style="text-align: center; font-weight: bold; color: #64748b;">${grade}</td>
                  <td style="font-weight: bold; color: #1e293b;">Kelas ${grade}</td>
                  <td>${item.day || '<span style="color: #94a3b8; font-style: italic;">Belum ditentukan</span>'}</td>
                  <td style="text-align: center; font-weight: bold; color: #334155;">${item.jamKe || '-'}</td>
                  <td style="text-align: center; font-weight: bold; color: #047857;">${item.jp ? `${item.jp} JP` : '-'}</td>
                  <td style="text-align: center; color: #475569;">${item.jp ? `${item.jp * 35} Menit` : '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="4" style="text-align: right; padding: 12px 14px;">Total Jam Pelajaran (JP):</td>
              <td style="text-align: center; color: #065f46; padding: 12px 14px;">${totalJpAllCalc} JP</td>
              <td style="text-align: center; color: #065f46; padding: 12px 14px;">${totalJpAllCalc * 35} Menit</td>
            </tr>
          </tfoot>
        </table>

        <div class="note-box">
          Keterangan: 1 JP sama dengan 35 menit. Total waktu efektif mengajar per minggu adalah ${totalJpAllCalc * 35} menit (${totalJpAllCalc} JP).
        </div>

        <table class="signatures">
          <tr>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              Mengetahui,<br/>Kepala Sekolah
              <div class="signature-space"></div>
              <span class="underline-name">${profile?.namaKepalaSekolah || '........................................'}</span><br/>
              <span style="font-size: 10pt; color: #64748b;">NIP. ${profile?.nipKepalaSekolah || '........................................'}</span>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              Guru Mata Pelajaran PAI
              <div class="signature-space"></div>
              <span class="underline-name">${profile?.namaGuru || 'Nama Guru, S.Pd.I'}</span><br/>
              <span style="font-size: 10pt; color: #64748b;">NIP. ${profile?.nip || '........................................'}</span>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
      type: 'application/msword'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Jadwal-Mengajar-PAI-${orientation}-${pageSize}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <Layout><div className="p-8">Memuat data...</div></Layout>;

  const totalJpAll = (Object.values(schedules) as ScheduleItem[]).reduce((acc, curr) => acc + (curr.jp || 0), 0);

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto space-y-10">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Jadwal & Beban JP</h1>
            <p className="text-slate-500 text-sm">Tentukan hari dan jumlah Jam Pelajaran (JP) untuk setiap kelas serta pratinjau & ekspor dokumen jadwal mengajar.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </div>

        {/* Input Table */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden p-2"
        >
          <div className="overflow-x-auto rounded-2xl border border-white/40 bg-white/30">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white/85 sticky top-0">
                <tr>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Kelas</th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Hari Mengajar</th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Jam Ke-</th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Beban JP / Minggu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {GRADES.map(grade => (
                  <tr key={grade} className="hover:bg-white/40 transition-colors">
                    <td className="p-4 font-bold text-slate-700">Kelas {grade}</td>
                    <td className="p-4">
                      <select 
                        value={schedules[grade]?.day || ''} 
                        onChange={(e) => handleChange(grade, 'day', e.target.value)}
                        className="w-full max-w-xs rounded-xl border-white bg-white/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-2 font-medium"
                      >
                        <option value="">-- Pilih Hari --</option>
                        {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        type="text"
                        placeholder="Contoh: 3, 4, 5 atau 2, 3, 4"
                        value={schedules[grade]?.jamKe || ''} 
                        onChange={(e) => handleChange(grade, 'jamKe', e.target.value)}
                        className="w-full max-w-xs rounded-xl border-white bg-white/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-2 font-medium text-slate-700"
                      />
                    </td>
                    <td className="p-4">
                      <select 
                        value={schedules[grade]?.jp || 0} 
                        onChange={(e) => handleChange(grade, 'jp', Number(e.target.value))}
                        className="w-full max-w-xs rounded-xl border-white bg-white/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 border p-2 font-medium"
                      >
                        <option value={0}>-- Pilih JP --</option>
                        <option value={2}>2 JP</option>
                        <option value={3}>3 JP</option>
                        <option value={4}>4 JP</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Placeholder / Pratinjau & Ekspor Jadwal Mengajar */}
        <div className="bg-white/60 border border-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-200/50 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200/60 pb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-emerald-600" size={22} />
                Pratinjau & Ekspor Dokumen Jadwal Mengajar
              </h2>
              <p className="text-slate-500 text-xs mt-1">Pilih orientasi & ukuran kertas pratinjau, lalu unduh dokumen Word (.doc) berformat rapi siap cetak.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Orientation Switch */}
              <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${orientation === 'portrait' ? 'bg-white shadow text-emerald-700' : 'hover:text-slate-900'}`}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${orientation === 'landscape' ? 'bg-white shadow text-emerald-700' : 'hover:text-slate-900'}`}
                >
                  Landscape
                </button>
              </div>

              {/* Page Size Switch */}
              <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setPageSize('A4')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${pageSize === 'A4' ? 'bg-white shadow text-emerald-700' : 'hover:text-slate-900'}`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('F4')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${pageSize === 'F4' ? 'bg-white shadow text-emerald-700' : 'hover:text-slate-900'}`}
                >
                  F4 (Folio)
                </button>
              </div>

              {/* Export Word Button */}
              <button
                type="button"
                onClick={handleDownloadWord}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer active:scale-95"
              >
                <FileText size={16} />
                Unduh Dokumen Word (.doc)
              </button>
            </div>
          </div>

          {/* Document Render Container (A4 / F4 preview) */}
          <div className="flex justify-center overflow-x-auto p-4 bg-slate-100/70 rounded-2xl border border-slate-200/80">
            <div 
              ref={previewRef}
              className={`bg-white text-slate-800 shadow-2xl transition-all duration-300 relative p-10 flex flex-col justify-between ${
                orientation === 'landscape' 
                  ? (pageSize === 'A4' ? 'w-[1123px] min-h-[794px]' : 'w-[1250px] min-h-[850px]')
                  : (pageSize === 'A4' ? 'w-[794px] min-h-[1123px]' : 'w-[850px] min-h-[1250px]')
              }`}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {/* Header Letterhead */}
              <div>
                <div className="text-center border-b-4 border-double border-emerald-800 pb-5 mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Pemerintah Kabupaten / Kementerian Agama</h3>
                  <h1 className="text-xl font-extrabold uppercase tracking-tight text-emerald-900 mt-1">{profile?.namaSekolah || 'SD NEGERI CONTOH'}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">NPSN: {profile?.npsn || '12345678'} — Tahun Pelajaran: {profile?.tahunPelajaran || '2026/2027'}</p>
                  <div className="mt-4 inline-block bg-emerald-50 border border-emerald-200 px-6 py-1.5 rounded-full text-emerald-800 font-bold text-xs shadow-sm">
                    JADWAL MENGAJAR GURU PENDIDIKAN AGAMA ISLAM (PAI)
                  </div>
                </div>

                {/* Teacher Meta Info */}
                <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/60 font-medium">
                  <div>
                    <p><span className="text-slate-400 font-normal">Nama Guru:</span> <strong className="text-slate-800">{profile?.namaGuru || 'Nama Guru, S.Pd.I'}</strong></p>
                    <p className="mt-1"><span className="text-slate-400 font-normal">NIP / NUPTK:</span> <strong className="text-slate-800">{profile?.nip || '-'}</strong></p>
                  </div>
                  <div>
                    <p><span className="text-slate-400 font-normal">Mata Pelajaran:</span> <strong className="text-slate-800">Pendidikan Agama Islam dan Budi Pekerti</strong></p>
                    <p className="mt-1"><span className="text-slate-400 font-normal">Total Beban JP:</span> <strong className="text-emerald-700">{totalJpAll} JP / Minggu</strong></p>
                  </div>
                </div>

                {/* Schedule Table */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm mb-6">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-emerald-800 text-white font-bold uppercase tracking-wider">
                        <th className="p-3.5 border-r border-emerald-700 text-center w-16">No</th>
                        <th className="p-3.5 border-r border-emerald-700">Kelas</th>
                        <th className="p-3.5 border-r border-emerald-700">Hari Mengajar</th>
                        <th className="p-3.5 border-r border-emerald-700 text-center">Jam Ke-</th>
                        <th className="p-3.5 border-r border-emerald-700 text-center">Beban JP</th>
                        <th className="p-3.5 text-center">Durasi / Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {GRADES.map((grade, idx) => {
                        const item = schedules[grade] || { day: '-', jp: 0, jamKe: '-' };
                        return (
                          <tr key={grade} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="p-3.5 border-r border-slate-200 text-center font-bold text-slate-500">{grade}</td>
                            <td className="p-3.5 border-r border-slate-200 font-bold text-slate-800">Kelas {grade}</td>
                            <td className="p-3.5 border-r border-slate-200 font-medium text-slate-700">{item.day || <span className="text-slate-300 italic">Belum ditentukan</span>}</td>
                            <td className="p-3.5 border-r border-slate-200 text-center font-semibold text-slate-700">{item.jamKe || '-'}</td>
                            <td className="p-3.5 border-r border-slate-200 text-center font-bold text-emerald-700">{item.jp ? `${item.jp} JP` : '-'}</td>
                            <td className="p-3.5 text-center font-medium text-slate-600">{item.jp ? `${item.jp * 35} Menit` : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                        <td colSpan={4} className="p-3.5 text-right border-r border-slate-200">Total Jam Pelajaran (JP):</td>
                        <td className="p-3.5 text-center border-r border-slate-200 text-emerald-800">{totalJpAll} JP</td>
                        <td className="p-3.5 text-center text-emerald-800">{totalJpAll * 35} Menit</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Important Note as requested */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs font-semibold text-amber-900 flex items-center gap-3">
                  <Clock className="text-amber-600 shrink-0" size={18} />
                  <span>Keterangan: 1 JP sama dengan 35 menit. Total waktu efektif mengajar per minggu adalah {totalJpAll * 35} menit ({totalJpAll} JP).</span>
                </div>
              </div>

              {/* Footer Signatures */}
              <div className="mt-12 pt-6 grid grid-cols-2 text-xs text-slate-700">
                <div className="text-center space-y-16">
                  <p className="font-medium">Mengetahui,<br />Kepala Sekolah</p>
                  <div>
                    <p className="font-bold underline text-slate-900">{profile?.namaKepalaSekolah || '........................................'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">NIP. {profile?.nipKepalaSekolah || '........................................'}</p>
                  </div>
                </div>
                <div className="text-center space-y-16">
                  <p className="font-medium">Guru Mata Pelajaran PAI</p>
                  <div>
                    <p className="font-bold underline text-slate-900">{profile?.namaGuru || 'Nama Guru, S.Pd.I'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">NIP. {profile?.nip || '........................................'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

