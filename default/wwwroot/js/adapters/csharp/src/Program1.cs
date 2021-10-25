class A{
  public int ParentField;
}

class B:A{
  public new int ParentField;
  public string ChildField;
}

class Program
{
  static void Main(string[] args)
  {
    A a = new A();
    B b = new B();
    b.ParentField = 90;
    b.ChildField = "child";
    A bintoa = b;
    bintoa.ParentField = 5;
  }
}

namespace Global{
	using System;
	using System.Reflection;
	public static class Closure {
		public static string getClosure(object f, string path){
			if(f == null) return "[K]K";
			try{
				var path_split = path.Split(".");
				var f_instance = f;
				foreach (var item in path_split)
				{
					if(item == "") continue;
					try{
						f_instance = f_instance.GetType().GetProperty(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}
					catch(Exception e){
						f_instance = f_instance.GetType().GetField(item,
																		System.Reflection.BindingFlags.NonPublic |
																		System.Reflection.BindingFlags.Instance |
																		System.Reflection.BindingFlags.Public |
																		System.Reflection.BindingFlags.Static).GetValue(f_instance);
					}

				}


				var closure = f_instance.GetType().GetFields(System.Reflection.BindingFlags.NonPublic |
																										System.Reflection.BindingFlags.Instance |
																										System.Reflection.BindingFlags.Public |
																										System.Reflection.BindingFlags.Static);
				var res_str = "";
				for (int i = 0; i < closure.Length; i++)
				{
						var closure_field = closure[i];
						var _f = closure_field.Name.Replace("$", "");
						var _v = closure_field.GetValue(f_instance);
						var _a = closure_field.GetValue(f_instance).GetHashCode();
						var _t = "";
						Type t = closure_field.GetValue(f_instance).GetType();
						bool isPrimitiveType = t.IsPrimitive || t.IsValueType || (t == typeof(string));
						if(isPrimitiveType){
							var tmp = closure_field.GetValue(f_instance).GetType().Name;
							_t = "#K" + tmp + "#K" + _v;
						}
						res_str += "{K" + _f + "#K" + _a + "#K" + isPrimitiveType.ToString().ToLower() + _t + "}K";
						if(i + 1 < closure.Length){
							res_str += "!K";
						}
				}
				return "[K" + "{KHashIs#K"+f_instance.GetHashCode()+"}K!K" + res_str + "]K";
			}
			catch(Exception e){
				return "[K]K";
			}
		}
	}
}