// =====================================================
// AuroraMaps.exe — peluncur Windows TERSEMBUNYI (mode aplikasi)
// =====================================================
// Dijalankan dengan dobel-klik; tidak ada jendela konsol sama sekali —
// hanya jendela aplikasi AuroraMaps yang terbuka:
//   1. Cek Node.js; bila belum ada → pesan jelas lewat MessageBox.
//   2. Port 8321 kosong? jalankan local-server.mjs TANPA jendela,
//      keluarannya ditulis ke auroramaps-server.log.
//   3. Port 8322 kosong? jalankan sidecar BHUMI (browser pendamping Edge
//      headless, juga tanpa jendela), keluarannya ke sidecar.log.
//   4. Buka Chrome (cadangan: Edge) --app=http://127.0.0.1:8321/
//      → jendela aplikasi tanpa tab/bilah.
//
// Opsi:
//   berhenti / --berhenti   hentikan server & sidecar (port 8321 & 8322)
//   login   / --show        jalankan sidecar BERJENDELA untuk login BHUMI sekali
//   --kering                hanya tulis rencana ke log, jangan menjalankan apa pun
//   --tanpa-sidecar         jangan menyalakan sidecar BHUMI
//
// Log: auroramaps-launcher.log  keputusan peluncur (ditimpa tiap kali jalan)
//      auroramaps-server.log    keluaran node server (ditimpa saat menyala)
//      sidecar.log              keluaran node sidecar (ditimpa saat menyala)
// Kompilasi:
//   csc /nologo /target:winexe /out:AuroraMaps.exe AuroraMaps.cs
// =====================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace AuroraMaps
{
    internal static class Program
    {
        const int PortServer = 8321;
        const int PortSidecar = 8322;
        const string AppUrl = "http://127.0.0.1:8321/";

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AttachConsole(int dwProcessId);
        const int AttachParentProcess = -1;

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
        const uint MbIconError = 0x10;
        const uint MbIconInfo = 0x40;

        static string _appDir = "";
        static readonly StringBuilder _log = new StringBuilder();

        static int Main(string[] args)
        {
            // Tanpa konsol bila dobel-klik; bila dipanggil dari CMD, hasil cetak
            // menempel ke konsol induk sehingga mode --kering bisa dibaca.
            AttachConsole(AttachParentProcess);

            bool kering = HasFlag(args, "--kering");
            bool tanpaSidecar = HasFlag(args, "--tanpa-sidecar");
            bool berhenti = HasFlag(args, "berhenti") || HasFlag(args, "--berhenti");
            bool login = HasFlag(args, "login") || HasFlag(args, "--show");
            _appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";

            Say("AuroraMaps | " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            Say("Folder aplikasi: " + _appDir);

            try
            {
                if (berhenti) return Hentikan();

                if (!File.Exists(Path.Combine(_appDir, "local-server.mjs")))
                {
                    return Gagal("Berkas local-server.mjs tidak ditemukan di:\n" + _appDir +
                        "\n\nJalankan kembali pemasang untuk memasang ulang.");
                }

                string node = FindNode();
                if (node == null)
                {
                    return Gagal("Node.js belum terpasang di PC ini.\n\nPasang dulu dari https://nodejs.org (versi LTS),\nlalu jalankan kembali AuroraMaps.");
                }
                Say("Node.js: " + node);

                bool serverHidup = IsPortOpen(PortServer);
                string browser = FindBrowser();
                string sidecarPath = Path.Combine(_appDir, "tools", "bhumi-bridge", "sidecar-host.mjs");

                if (kering)
                {
                    Say("[kering] server port " + PortServer + ": " + (serverHidup ? "sudah jalan" : "akan dijalankan (tersembunyi)"));
                    Say("[kering] node: " + Quote(node) + " " + Quote(Path.Combine(_appDir, "local-server.mjs")));
                    if (!tanpaSidecar)
                    {
                        Say("[kering] sidecar port " + PortSidecar + ": " +
                            (IsPortOpen(PortSidecar) ? "sudah jalan" :
                             (File.Exists(sidecarPath) ? "akan dijalankan" : "berkas tidak ada - dilewati")) +
                            (IsPortOpen(PortSidecar) ? "" : (login ? "  [dengan jendela login --show]" : "  [tersembunyi, headless]")));
                    }
                    Say("[kering] peramban: " + (browser ?? "(tidak ditemukan)"));
                    if (browser != null) Say("[kering] argumen: --app=" + AppUrl);
                    return 0;
                }

                // 1) Server lokal — tersembunyi, tanpa jendela ------------------
                if (!serverHidup)
                {
                    Say("Menyalakan server lokal -> " + AppUrl + " (tanpa jendela)");
                    StartTersembuni(node, Quote(Path.Combine(_appDir, "local-server.mjs")),
                        Path.Combine(_appDir, "auroramaps-server.log"));
                    if (!WaitPort(PortServer, 25000))
                        return Gagal("Server lokal tidak bersedia di port " + PortServer +
                            ".\n\nLihat berkas auroramaps-server.log di folder:\n" + _appDir);
                }
                Say("Server lokal siap.");

                // 2) Sidecar BHUMI — Edge pendamping tetap tersembunyi ---------
                if (!tanpaSidecar)
                {
                    // Mode login: sidecar lama ditutup dulu agar jendela login bisa terbuka.
                    if (login && IsPortOpen(PortSidecar))
                    {
                        Say("Menutup sidecar lama agar jendela login bisa terbuka...");
                        HentikanPort(PortSidecar);
                        int tunggu = 0;
                        while (IsPortOpen(PortSidecar) && tunggu < 6000) { Thread.Sleep(250); tunggu += 250; }
                    }
                    // Proses Edge/Chrome pendamping dari sesi lama (termasuk yang
                    // tersisa tanpa sidecar) wajib ikut mati — kalau tidak, profil
                    // tetap terkunci dan jendela login tidak akan muncul.
                    if (login) MatikanPendampingProfil();

                    if (!IsPortOpen(PortSidecar))
                    {
                        if (File.Exists(sidecarPath))
                        {
                            string tambahan = login ? " --show" : "";
                            Say(login
                                ? "Menyalakan sidecar BHUMI dengan jendela login..."
                                : "Menyalakan sidecar BHUMI (tersembunyi, headless)...");
                            StartTersembuni(node, Quote(sidecarPath) + tambahan,
                                Path.Combine(_appDir, "sidecar.log"));
                            if (!WaitPort(PortSidecar, 30000))
                                Say("Peringatan: sidecar belum siap dalam 30 detik - cek sidecar.log.");
                            else
                                Thread.Sleep(1500);
                        }
                        else
                        {
                            Say("Sidecar tidak ada (" + sidecarPath + ") - dilewati.");
                        }
                    }
                    else
                    {
                        Say("Sidecar sudah berjalan.");
                    }

                    // Status sesi BHUMI — satu-satunya pesan yang tampil ke layar.
                    if (!login && IsPortOpen(PortSidecar))
                    {
                        string sesi = CekSesi();
                        Say("Sesi BHUMI: " + sesi);
                        if (sesi == "TIDAK")
                        {
                            MessageBoxW(IntPtr.Zero,
                                "Sesi BHUMI belum aktif.\n\n" +
                                "Tile bidang tanah, cari SHM, dan klik bidang butuh login sekali:\n" +
                                "    AuroraMaps.exe login\n\n" +
                                "Lalu login di jendela Edge pendamping yang terbuka.\n" +
                                "Klik OK untuk membuka aplikasi.",
                                "AuroraMaps", MbIconInfo);
                        }
                    }
                }

                // 3) Jendela aplikasi tanpa bilah (yang ini MEMANG terlihat) ----
                if (browser == null)
                    return Gagal("Google Chrome / Microsoft Edge tidak ditemukan.\n\nAuroraMaps butuh Chrome atau Edge untuk membuka jendela aplikasi.");

                Say("Membuka " + Path.GetFileName(browser) + " dalam mode aplikasi...");
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browser;
                psi.Arguments = "--app=" + AppUrl + " --no-first-run --no-default-browser-check";
                psi.UseShellExecute = true;
                psi.WorkingDirectory = _appDir;
                Process.Start(psi);

                Say("Selesai - jendela AuroraMaps terbuka. Semua layanan berjalan tanpa jendela.");
                return 0;
            }
            catch (Exception ex)
            {
                return Gagal("Gagal menjalankan AuroraMaps:\n" + ex.Message);
            }
            finally
            {
                try
                {
                    File.WriteAllText(Path.Combine(_appDir, "auroramaps-launcher.log"), _log.ToString());
                }
                catch { /* log gagal tulis bukanlah kegagalan aplikasi */ }
            }
        }

        // ── Berhenti: hentikan proses yang memegang port 8321 & 8322 ────────
        static int Hentikan()
        {
            int jumlah = 0;
            int[] ports = new int[] { PortServer, PortSidecar };
            foreach (int port in ports) jumlah += HentikanPort(port);
            MatikanPendampingProfil();

            if (jumlah == 0)
            {
                Say("Tidak ada server / sidecar AuroraMaps yang berjalan.");
                MessageBoxW(IntPtr.Zero, "Tidak ada server / sidecar AuroraMaps yang berjalan.", "AuroraMaps", MbIconInfo);
            }
            else
            {
                Say("Selesai - " + jumlah + " layanan dihentikan.");
                MessageBoxW(IntPtr.Zero, "Server dan sidecar AuroraMaps sudah dihentikan.", "AuroraMaps", MbIconInfo);
            }
            return 0;
        }

        static int HentikanPort(int port)
        {
            int n = 0;
            foreach (int pid in CariPidPort(port))
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "taskkill.exe";
                    psi.Arguments = "/f /t /pid " + pid;
                    psi.UseShellExecute = false;
                    psi.CreateNoWindow = true;
                    using (Process p = Process.Start(psi)) p.WaitForExit(8000);
                    Say("Menghentikan port " + port + " (PID " + pid + ").");
                    n++;
                }
                catch (Exception e)
                {
                    Say("Gagal menghentikan PID " + pid + ": " + e.Message);
                }
            }
            return n;
        }

        // Matikan Edge/Chrome pendamping yang memakai profil di folder ini
        // (proses yatim dari sesi lama ikut terhapus sehingga profil tidak
        // tetap terkunci). Proses peramban biasa pengguna TIDAK tersentuh
        // karena hanya yang jalurnya memuat folder profil sidecar yang dibunuh.
        static void MatikanPendampingProfil()
        {
            try
            {
                string folder = Path.Combine(_appDir, "tools", "bhumi-bridge");
                string ps =
                    "Get-CimInstance Win32_Process | Where-Object { " +
                    "($_.Name -eq 'msedge.exe' -or $_.Name -eq 'chrome.exe') -and " +
                    "$_.CommandLine -like '*" + folder.Replace("'", "''") + "*' } | " +
                    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";

                string powershell = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                    "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = powershell;
                psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command \"" + ps + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi)) p.WaitForExit(15000);
                Say("Proses Edge/Chrome pendamping di folder ini dihentikan.");
            }
            catch (Exception e)
            {
                Say("Gagal membersihkan proses pendamping: " + e.Message);
            }
        }

        // Cari PID yang mendengarkan port tertentu (lewat netstat -ano).
        static List<int> CariPidPort(int port)
        {
            List<int> hasil = new List<int>();
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "netstat.exe";
                psi.Arguments = "-ano";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardOutput = true;
                using (Process p = Process.Start(psi))
                {
                    string teks = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(10000);
                    foreach (string baris in teks.Split('\n'))
                    {
                        string[] kolom = baris.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                        if (kolom.Length < 5) continue;
                        if (kolom[3] != "LISTENING") continue;
                        string local = kolom[1];
                        int titik = local.LastIndexOf(':');
                        if (titik < 0) continue;
                        int pt, pid;
                        if (int.TryParse(local.Substring(titik + 1), out pt) && pt == port &&
                            int.TryParse(kolom[4], out pid) && !hasil.Contains(pid))
                            hasil.Add(pid);
                    }
                }
            }
            catch (Exception e)
            {
                Say("Gagal membaca netstat: " + e.Message);
            }
            return hasil;
        }

        // Status sesi BHUMI dari sidecar: "YA" | "TIDAK" | "?" (tak terjawab).
        static string CekSesi()
        {
            try
            {
                HttpWebRequest r = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + PortSidecar + "/status");
                r.Timeout = 6000;
                r.Method = "GET";
                using (HttpWebResponse resp = (HttpWebResponse)r.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream()))
                {
                    string body = sr.ReadToEnd();
                    if (body.Contains("\"loggedIn\":true")) return "YA";
                    if (body.Contains("\"loggedIn\":false")) return "TIDAK";
                    return "?";
                }
            }
            catch { return "?"; }
        }

        // ── Utilitas ────────────────────────────────────────────────────────
        static bool HasFlag(string[] args, string flag)
        {
            foreach (string a in args)
                if (string.Equals(a, flag, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        static string Quote(string path)
        {
            return "\"" + path + "\"";
        }

        static void Say(string text)
        {
            _log.AppendLine(text);
            Console.WriteLine(text);
        }

        static int Gagal(string pesan)
        {
            Say("GAGAL: " + pesan.Replace("\n", " | "));
            MessageBoxW(IntPtr.Zero, pesan, "AuroraMaps", MbIconError);
            return 1;
        }

        // Port terbuka = sudah ada yang mendengarkan (server/sidecar lama dipakai ulang).
        static bool IsPortOpen(int port)
        {
            try
            {
                using (TcpClient c = new TcpClient())
                {
                    IAsyncResult t = c.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = t.AsyncWaitHandle.WaitOne(700, false);
                    if (!ok) return false;
                    c.EndConnect(t);
                    return true;
                }
            }
            catch { return false; }
        }

        static bool WaitPort(int port, int timeoutMs)
        {
            int lewat = 0;
            while (lewat < timeoutMs)
            {
                if (IsPortOpen(port)) return true;
                Thread.Sleep(300);
                lewat += 300;
            }
            return IsPortOpen(port);
        }

        // Jalankan proses TANPA jendela apa pun. Keluarannya dialihkan ke
        // berkas log lewat `cmd /c ... > log 2>&1` (tanda kutip ganda di awal
        // mengikuti aturan parse cmd sehingga jalur ber-spasi tetap utuh).
        static void StartTersembuni(string exe, string args, string berkasLog)
        {
            string cmd = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32", "cmd.exe");

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = cmd;
            psi.Arguments = "/c \"" + Quote(exe) + " " + args + " > " + Quote(berkasLog) + " 2>&1\"";
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.WorkingDirectory = _appDir;
            psi.ErrorDialog = false;
            Process.Start(psi);
        }

        static string FindNode()
        {
            List<string> kandidat = new List<string>();
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string bagian in path.Split(';'))
            {
                string d = bagian.Trim().Trim('"');
                if (d.Length > 0) kandidat.Add(Path.Combine(d, "node.exe"));
            }
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "nodejs", "node.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "nodejs", "node.exe"));
            if (local.Length > 0) kandidat.Add(Path.Combine(local, "Programs", "nodejs", "node.exe"));

            foreach (string k in kandidat)
            {
                try { if (File.Exists(k)) return k; } catch { /* kandidat tak terbaca - abaikan */ }
            }
            return null;
        }

        static string FindBrowser()
        {
            List<string> kandidat = new List<string>();
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe"));
            if (local.Length > 0) kandidat.Add(Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe"));
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe"));
            if (local.Length > 0) kandidat.Add(Path.Combine(local, "Microsoft", "Edge", "Application", "msedge.exe"));

            // Peramban yang hanya terdaftar di PATH.
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string bagian in path.Split(';'))
            {
                string d = bagian.Trim().Trim('"');
                if (d.Length == 0) continue;
                kandidat.Add(Path.Combine(d, "chrome.exe"));
                kandidat.Add(Path.Combine(d, "msedge.exe"));
            }

            foreach (string k in kandidat)
            {
                try { if (File.Exists(k)) return k; } catch { /* kandidat tak terbaca - abaikan */ }
            }
            return null;
        }
    }
}