//go:build windows

// Pacote inst: tudo que o instalador e o desinstalador do ComicXD fazem no
// Windows, sempre no perfil do usuário (HKCU e %LOCALAPPDATA%): não exige
// administrador.
package inst

import (
	"fmt"
	"os"
	"path/filepath"

	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	ChaveDesinstalar = `Software\Microsoft\Windows\CurrentVersion\Uninstall\ComicXD`
	NomeAtalho       = "ComicXD.lnk"
	NomeExe          = "ComicXD.exe"
	NomeMarca        = "instalado.txt"
	SiteProjeto      = "https://github.com/IntuneOverseer/ComicXD"
)

func PastaInstalacaoPadrao() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "ComicXD")
}

// PastaDadosInstalado é onde o app instalado guarda biblioteca e progresso.
func PastaDadosInstalado() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "ComicXD")
}

func pastaConhecida(id *windows.KNOWNFOLDERID) (string, error) {
	return windows.KnownFolderPath(id, windows.KF_FLAG_DEFAULT)
}

func CaminhoAtalhoMenuIniciar() (string, error) {
	p, err := pastaConhecida(windows.FOLDERID_Programs)
	if err != nil {
		return "", err
	}
	return filepath.Join(p, NomeAtalho), nil
}

func CaminhoAtalhoAreaDeTrabalho() (string, error) {
	p, err := pastaConhecida(windows.FOLDERID_Desktop)
	if err != nil {
		return "", err
	}
	return filepath.Join(p, NomeAtalho), nil
}

// CriarAtalho cria um .lnk via WScript.Shell. Chamar na thread que a janela/
// instalador usa (o pacote inicializa e finaliza o COM por conta própria).
func CriarAtalho(lnk, alvo, pastaTrabalho, descricao string) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("falha ao criar atalho: %v", r)
		}
	}()
	if e := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); e != nil {
		// S_FALSE (já inicializado) não vem como erro; qualquer erro aqui é real
		if oe, ok := e.(*ole.OleError); !ok || oe.Code() != 1 {
			return fmt.Errorf("COM: %v", e)
		}
	}
	defer ole.CoUninitialize()

	if err := os.MkdirAll(filepath.Dir(lnk), 0o755); err != nil {
		return err
	}
	unk, err := oleutil.CreateObject("WScript.Shell")
	if err != nil {
		return fmt.Errorf("WScript.Shell indisponível: %w", err)
	}
	defer unk.Release()
	shell, err := unk.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return err
	}
	defer shell.Release()
	v, err := oleutil.CallMethod(shell, "CreateShortcut", lnk)
	if err != nil {
		return err
	}
	sc := v.ToIDispatch()
	defer sc.Release()
	for _, kv := range [][2]string{
		{"TargetPath", alvo},
		{"WorkingDirectory", pastaTrabalho},
		{"Description", descricao},
		{"IconLocation", alvo + ",0"},
	} {
		if _, err := oleutil.PutProperty(sc, kv[0], kv[1]); err != nil {
			return fmt.Errorf("%s: %w", kv[0], err)
		}
	}
	if _, err := oleutil.CallMethod(sc, "Save"); err != nil {
		return err
	}
	return nil
}

// RegistrarDesinstalacao cria a entrada em "Aplicativos instalados".
func RegistrarDesinstalacao(dir, versao string, tamanhoKB uint32) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, ChaveDesinstalar, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	exe := filepath.Join(dir, NomeExe)
	for _, kv := range [][2]string{
		{"DisplayName", "ComicXD"},
		{"DisplayVersion", versao},
		{"Publisher", "ComicXD (código aberto)"},
		{"InstallLocation", dir},
		{"DisplayIcon", exe + ",0"},
		{"UninstallString", `"` + exe + `" --desinstalar`},
		{"URLInfoAbout", SiteProjeto},
	} {
		if err := k.SetStringValue(kv[0], kv[1]); err != nil {
			return fmt.Errorf("%s: %w", kv[0], err)
		}
	}
	for _, kv := range []struct {
		n string
		v uint32
	}{{"NoModify", 1}, {"NoRepair", 1}, {"EstimatedSize", tamanhoKB}} {
		if err := k.SetDWordValue(kv.n, kv.v); err != nil {
			return fmt.Errorf("%s: %w", kv.n, err)
		}
	}
	return nil
}

// LocalInstalado lê da entrada de desinstalação onde o ComicXD está instalado.
func LocalInstalado() (string, error) {
	k, err := registry.OpenKey(registry.CURRENT_USER, ChaveDesinstalar, registry.QUERY_VALUE)
	if err != nil {
		return "", err
	}
	defer k.Close()
	s, _, err := k.GetStringValue("InstallLocation")
	return s, err
}

func RemoverRegistro() error {
	err := registry.DeleteKey(registry.CURRENT_USER, ChaveDesinstalar)
	if err == registry.ErrNotExist {
		return nil
	}
	return err
}
