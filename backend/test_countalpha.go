package main

func CountAlpha(s string) int {
	y := 0
	for _, x := range s {
		if (x >= 'a' && x <= 'z') || (x >= 'A' && x <= 'Z') {
			y++
		}
	}
	return y
}