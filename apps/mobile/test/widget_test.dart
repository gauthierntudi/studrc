import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:studrc/app.dart';

void main() {
  testWidgets('STUDRC app boots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: StudrcApp()));
    expect(find.text('STUDRC'), findsWidgets);
  });
}
