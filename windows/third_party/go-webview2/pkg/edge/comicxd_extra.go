//go:build windows

package edge

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// MapearHost é a versão do SetVirtualHostNameToFolderMapping que devolve o
// HRESULT de verdade (a original compara GetLastError, que pode estar sujo
// por chamadas anteriores). Arquivo acrescentado pelo ComicXD.
// Sucesso: valor >= 0.
func (i *ICoreWebView2_3) MapearHost(hostName, folderPath string, accessKind COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND) (hresult int32, err error) {
	h, err := windows.UTF16PtrFromString(hostName)
	if err != nil {
		return -1, err
	}
	f, err := windows.UTF16PtrFromString(folderPath)
	if err != nil {
		return -1, err
	}
	r, _, _ := i.vtbl.SetVirtualHostNameToFolderMapping.Call(
		uintptr(unsafe.Pointer(i)),
		uintptr(unsafe.Pointer(h)),
		uintptr(unsafe.Pointer(f)),
		uintptr(accessKind),
	)
	return int32(r), nil
}
