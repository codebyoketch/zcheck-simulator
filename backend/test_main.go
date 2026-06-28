package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	line := ""
	if scanner.Scan() {
		line = scanner.Text()
	}
	fmt.Println(CountAlpha(line))
}