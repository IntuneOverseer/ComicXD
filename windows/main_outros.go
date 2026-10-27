//go:build !windows

package main

import "fmt"

// Este programa só roda no Windows; esta função existe para os testes
// da lógica pura (estado.go) poderem ser executados em outros sistemas.
func main() { fmt.Println("ComicXD para Windows: compile com GOOS=windows") }
