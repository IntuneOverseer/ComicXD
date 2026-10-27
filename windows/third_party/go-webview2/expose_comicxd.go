//go:build windows

package webview2

import "github.com/jchv/go-webview2/pkg/edge"

// Chromium expõe o motor interno (arquivo acrescentado pelo ComicXD; nenhum
// arquivo original da biblioteca foi alterado).
func Chromium(w WebView) *edge.Chromium {
	if v, ok := w.(*webview); ok {
		if c, ok := v.browser.(*edge.Chromium); ok {
			return c
		}
	}
	return nil
}
